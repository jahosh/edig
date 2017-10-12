const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');
const dotenv = require('dotenv');
const os = require('os');
const express = require('express');
const compression = require('compression');
const slugify = require('slugify');
const morgan = require('morgan');
const helmet = require('helmet');
const Model = require('objection').Model;
const knexConfig = require('./knexfile');
const Knex = require('knex');
const app = express();
const server = require('http').createServer(app);
const cookieParser = require('cookie-parser');
const raw = require('objection').raw;
const cors = require('cors');
const request = require('request-promise');
const https = require('https');
const io = require('socket.io')(server);
io.origins('http://localhost:8000');

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const Sample = require('./models/Sample');
const knex = Knex(knexConfig['development']);
Model.knex(knex);

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

dotenv.load();
app.options('*', cors());
app.use(cors());
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(compression());
app.use(express.static(__dirname + '/public'));
app.use(morgan('dev'));
app.use(helmet());


server.listen(3001, () => {
  console.log('listening on 3001');
});


io.on('connection', (socket) => {
  app.get('/dig', (req, res) => {
    const { src, start, end, full, category } = req.query;

    let s = Number(start);
    let e = Number(end);
    const downloadFull = full === 'False' ? false : true;
    const meta = getMetaData(src)
      .then( async (metadata) => {
        let title = metadata.title;
        let length = metadata.length_seconds;
        let thumbnailSrc = metadata.thumbnail_url.substring(0, 35);
        let endTime = end > length ? length : end;
        let thumbnail = await getProperImage(thumbnailSrc, 0);

        console.log('this is thumbnail', thumbnail);
        // 6 min is seconds
        if (length > 360) {
          res.status(400).send({ error: 'sample is too long!' });
          return;
        }

        const sample = { title, thumbnail, src, category };

        dlVid(src, io)
          .then((vid) => {
            const randomId = randomGen();
            const name = slugify(`${title}-${randomId}.mp3`);
            const command = processVideo(vid, downloadFull, name, start, end, length);
            sample.sample_src = name;
            command.run();
            command.on('error', (err, stdout, stderr) => {
              console.log(err.message, err, stderr);
              res.send(JSON.stringify('error'))
            });
            command.on('end', () => {
              
              // upload to S3
              uploadToS3(vid, name, io)
                .then((data) => {
                  // song successfully uploaded to s3
                  console.log(data);
                  res.end(JSON.stringify({
                    link: data.Location,
                    title,
                    thumbnail,
                    sample
                  }));
                })
                .catch(e => {
                  console.log(e);
                });
            });
          })
          .catch(e => {
            console.log(e);
            res.end('error');
          });
      })
      .catch(e => {
        console.log('error here', e);
        res.end(JSON.stringify({ e, msg: 'unable to locate video, please try another link' }));
      });
  });
});

app.get('/', (req, res) => {
  let { page } = req.query;
  let cookies = req.cookies;

  if (!page) {
    page = 0
    currentPage = 1;
  }

  const samples = Sample
    .query()
    .orderBy('id', 'desc')
    .page(page, 5)
    .skipUndefined()
    .limit(5)
    .then(samples => {
      let total = samples.total;
      let finalSamples = samples.results;
      let totalPages = Number(Math.floor(total/5));
      let currentPage = Number(page);
      let endPage = Number(page) + 5;

      if (currentPage === totalPages) {
        endPage = currentPage;
      }
      try {
        cookies = Object.keys(cookies).map(key => cookies[key] = key);

      } catch(e) {
        console.log(e);
      }

      res.render('index', { 
        samples: finalSamples, 
        total, 
        totalPages, 
        currentPage, 
        endPage, 
        cookies, 
      });
    })
    .catch(e => {
      console.log(e);
      res.render('something went wrong')
    });
});


app.get('/download', (req, res) => {
  let { link, slug } = req.query;

  if (slug) {
    link = 'temp/' + slugify(`${link}`);
  }

  if (!link || !link.includes('temp')) {
    res.redirect('/');
    return;
  }

  res.download(link, function (err) {
    if (err) {
      console.log(err);
    } else {

    }
  });
});

app.get('/play', (req, res) => {
  const { sample } = req.query;
  const exists = fs.existsSync(`temp/${sample}`);

  if (!exists) {
    res.end('no file');
  } else {
    const file = fs.createReadStream(`temp/${sample}`);
    file.pipe(res);
  }
});

app.post('/like/:id', (req, res) => {
  const { id } = req.params;

  if (req.cookies[`_yts-like-${id}`]) {
    res.end('already liked!');
    return;
  }

  Sample
    .query()
    .where('id', '=', id)
    .increment('likes', 1)
    .then((s) => {
      if(s === 1) {
        res.cookie(`_yts-like-${id}`, 'true', {expire: new Date() + 9999});
        res.status(201).end();
      }
    })
    .catch(e => {
      console.log(e);
    });
})

app.get('/search', (req, res) => {
  const { term } = req.query;
  let cookies = req.cookies;
  
  try {
    cookies = Object.keys(cookies).map(key => cookies[key] = key);

  } catch (e) {
    console.log(e);
  }
  
  if (!term) {
    res.status(200).render('search', { results: [], cookies, directHit: true });
    return;
  }
  Sample
    .query()
    .select(raw('*'))
    .where('title', 'like', `%${term}%`)
    .then(results => {
      res.render('search', { results, cookies, directHit: false })
    })
    .catch(e => {
      console.log(e);
    });
});

function dlVid(src, socket) {
  return new Promise((fulfill, reject) => {
    try {
      const dl = ytdl(src, {
        filter: 'audioonly'
      });

      dl.on('progress', (c, td, tdl) => {
        const floatDownloaded = td/tdl;
        let progress = (floatDownloaded * 100).toFixed(2);
        socket.emit('progress', progress);
      });
      
      dl.on('info', (info) => {

      });

      dl.on('end', () => {
        socket.emit('progress', 100);
      });

      dl.on('data', () => {
      })
      fulfill(dl);
    } catch(e) {
      return reject(e);
    }
  });
}

function getMetaData(src) {
  return new Promise((fulfill, reject) => {
    ytdl.getInfo(src, (err, info) => {
      if (err) {
        reject(err);
      } else {
        fulfill(info);
      }
    });
  });
}

function randomGen() {
  return Math.floor((Math.random() * 10000000) + 1);
}

function processVideo(vid, full, name, start, end, length) {
  if (full) {
    start = 0;
    end = length;
    console.log('full!');
  }
  return ffmpeg(vid)
    .noVideo()
    .audioCodec('libmp3lame')
    .audioBitrate(320)
    .seekInput(start)
    .duration(end - start)
    .output(`temp/${name}`);
}

function uploadToS3(file, name, socket) {
  return new Promise((fulfill, reject) => {
    const params = {
      Bucket: process.env.S3_DEV_BUCKET,
      Key: name,
      Body: fs.createReadStream(`temp/${name}`),
      ContentType: 'audio/mpeg',
      ACL: 'public-read'
    };

    const upload = s3.upload(params)
      .on('httpUploadProgress', (e) => {
        console.log('progress:', e.loaded / e.total);
        let uploadProgress = e.loaded/e.total;
        console.log(uploadProgress, typeof uploadProgress);
        if (uploadProgress === 1) {
          socket.emit('final-processing', 'final-processing');
        }
      })
      .send((err, data) => {
      if (err) {
        return reject(err);
      }
      return fulfill(data);
    });
  });
}


async function getProperImage(src, attempt) {
  let response;
  const keys = {
    '0': 'maxresdefault.jpg',
    '1': 'mqdefault.jpg',
    '2': 'default.jpg'
  }

  try {
    response = await request({
      method: 'GET',
      uri: `${src}${keys[attempt]}`,
      resolveWithFullResponse: true
    });

    if (response.statusCode === 200) {
      console.log(src + keys[attempt]);
      return src + keys[attempt];
    }
    console.log(response.statusCode);
  } catch (e) {
    return getProperImage(src, attempt + 1);
  }
}

