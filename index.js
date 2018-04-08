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
const app = express();
const server = require('http').createServer(app);
const cookieParser = require('cookie-parser');
const cors = require('cors');
const request = require('request-promise');
const https = require('https');
const io = require('socket.io')(server);
io.origins('http://localhost:8000');
dotenv.load();

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

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
  app.get('/dig', async (req, res) => {
    const { src, start, end, full, category } = req.query;
    const downloadFull = full === 'False' ? false : true;

    let s = Number(start);
    let e = Number(end);

    try {
      const metadata = await getMetaData(src);
      const title = metadata.title;
      const length = metadata.length_seconds;
      const thumbnailSrc = metadata.thumbnail_url.substring(0, 35);
      const endTime = end > length ? length : end;
      const thumbnail = await getProperImage(thumbnailSrc, 0);
  
      const sampleLength = Math.abs(start - end);
      // 6 min is seconds
      if (sampleLength > 60) {
        res.status(400).send({ error: 'max sample duration: 1 minute'});
        return;
      }
      if (length > 600) {
        res.status(400).send({ error: 'sample is too long!' });
        return;
      }
  
      const sample = { title, thumbnail, src, category };
  
      const vid = await dlVid(src, io)
      const randomId = randomGen();
      const name = slugify(`${title}-${randomId}.mp3`);
      const command = processVideo(vid, downloadFull, name, start, end, length);
      sample.sample_src = name;
      command.run();
      command.on('error', (err, stdout, stderr) => {
        return res.status(400).send(JSON.stringify('error'))
      });
      command.on('end', async() => {
        // upload to S3
        try {
          const { Location:link } = await uploadToS3(vid, name, io);

          res.status(201).end(JSON.stringify({
            link,
            title,
            thumbnail,
            sample
          }));
        } catch(e) {
          res.status(400);
        }
      });
    } catch (e) {
      return res.status(400).end(JSON.stringify({ e, msg: 'unable to locate video, please try another link' }));
    }
  });
});

async function dlVid(src, socket) {
    try {
      const dl = ytdl(src, { filter: 'audioonly' });
      return dl;
    } catch(e) {
      throw e;
    }
};

async function getMetaData(src) {
    try {
      return await ytdl.getInfo(src);
    } catch(e) {
      throw e;
    }
};

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

async function uploadToS3(file, name, socket) {
    const params = {
      Bucket: process.env.S3_DEV_BUCKET,
      Key: name,
      Body: fs.createReadStream(`temp/${name}`),
      ContentType: 'audio/mpeg',
      ACL: 'public-read'
    };
    
    return await s3.upload(params)
      .on('httpUploadProgress', (e) => {
        let uploadProgress = e.loaded/e.total;
        if (uploadProgress === 1) {
          socket.emit('final-processing', 'final-processing');
        }
      }).promise();
};

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
      return src + keys[attempt];
    }
  } catch (e) {
    return getProperImage(src, attempt + 1);
  }
}
