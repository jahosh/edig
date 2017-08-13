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
const io = require('socket.io')(server);

dotenv.load();
const Sample = require('./models/Sample');
const knex = Knex(knexConfig['production']);
Model.knex(knex);
io.on('connection', (socket) => {
  app.get('/dig', (req, res) => {
    const { src, start, end, full } = req.query;
    const downloadFull = (full == 'true');
    const meta = getMetaData(src)
      .then((metadata) => {
        let title = metadata.title;
        let length = metadata.length_seconds;
        let thumbnail = metadata.thumbnail_url;
        let endTime = end > length ? length : end;

        const sample = { title, thumbnail, src };

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

              Sample
                .query()
                .insertAndFetch(sample)
                .catch(e => {
                  console.log(e);
                });

              res.end(JSON.stringify({
                link: `temp/${name}`,
                title,
                thumbnail
              }));
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

app.set('view engine', 'ejs');
app.use(compression())
app.use(express.static(__dirname + '/public'));
app.use(morgan('dev'));
app.use(helmet());


app.get('/', (req, res) => {
  const samples = Sample
    .query()
    .orderBy('id', 'desc')
    .skipUndefined()
    .limit(6)
    .then(samples => {
      // console.log(samples);
      Sample
        .query()
        .count('id')
        .first()
        .then(count => {
          let total = count['count(`id`)']
          res.render('index', { samples, total });
        })
        .catch(e => {
          console.log(e);
          res.render('something went wrong');
        })
    })
    .catch(e => {
      console.log(e);
      res.render('something went wrong')
    });
});


app.get('/download', (req, res) => {
  const { link } = req.query;

  if (!link || !link.includes('temp')) {
    res.redirect('/');
    return;
  }
  res.download(link, function (err) {
    if (err) {
      console.log(err);
    } else {
      // try {
      //   fs.unlink(link, (err) => {
      //     if (err) {
      //       console.log(err);
      //       res.end();
      //     } else {
      //       res.end('file downloaded');
      //     }
      //   });
      // } catch(e) {
      //   console.log(e);
      // }
    }
  });
});

app.get('/play', (req, res) => {
  const { sample } = req.query;
  const exists = fs.existsSync(`temp/${sample}`);
  console.log(exists);

  if (!exists) {
    res.end('no file');
  } else {
    const file = fs.createReadStream(`temp/${sample}`);
    file.pipe(res);
  }
});

server.listen(3000, () => {
  console.log('listening on 3000');
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
  }

  return ffmpeg(vid)
    .noVideo()
    .audioCodec('libmp3lame')
    .audioBitrate(320)
    .seekInput(start)
    .duration(end - start)
    .output(`temp/${name}`);
}

