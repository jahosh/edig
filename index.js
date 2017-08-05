const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');
const os = require('os');
const express = require('express');
const compression = require('compression');

const app = express();

app.set('view engine', 'ejs');
app.use(compression())
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.render('index');
});


app.get('/dig', (req, res) => {
  const { src, start, end } = req.query;

  const meta = getMetaData(src)
    .then((metadata) => {
      let title = metadata.title;
      let length = metadata.length_seconds;
      let thumbnail = metadata.thumbnail_url;

      let endTime = end > length? length : end;

    dlVid(src)
      .then((vid) => {
        const randomId = randomGen();
        const command = ffmpeg(vid)
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate(128)
          .seekInput(start)
          .duration(20)
          .output(`temp/${title}_${randomId}.mp3`)

        command.run();
        command.on('error', (err, stdout, stderr) => {
          console.log(err.message, err, stderr);
        });
        command.on('end', () => {
          res.end(JSON.stringify({
            link: `temp/${title}_${randomId}.mp3`
          }));
        });
      })
      .catch(e => {
        console.log(e);
        res.send(JSON.stringify(e));
      });
    })
    .catch(e => {
      console.log(e);
      res.send(JSON.stringify(e));
    });
});


app.get('/download', (req, res) => {
  const { link } = req.query;
  console.log(req.query);
  console.log(link);

  res.download(link, function (err) {
    if (err) {
      console.log(err);
    } else {
      res.end('file downloaded');
    }
  });
})


app.listen(3000, () => {
  console.log('running on port 3000');
});



function dlVid(src) {
  return new Promise((fulfill, reject) => {
    try {
      return fulfill(ytdl(src, {
      }));
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




