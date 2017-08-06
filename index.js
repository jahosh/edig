const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');
const os = require('os');
const express = require('express');
const compression = require('compression');
const slugify = require('slugify');
const morgan = require('morgan');

const app = express();

app.set('view engine', 'ejs');
app.use(compression())
app.use(express.static(__dirname + '/public'));
app.use(morgan('dev'));

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
      let endTime = end > length ? length : end;

    dlVid(src)
      .then((vid) => {
        const randomId = randomGen();
        const name = slugify(`${title}-${randomId}.mp3`);
        const command = processVideo(vid, false, name, start, end);

        command.run();
        command.on('error', (err, stdout, stderr) => {
          console.log(err.message, err, stderr);
        });
        command.on('end', () => {
          res.end(JSON.stringify({
            link: `temp/${name}`,
            title,
            thumbnail
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
  console.log('this is req.query', req.query)
  console.log('this is link on server', link);

  res.download(link, function (err) {
    if (err) {
      console.log(err);
    } else {
      try {
        fs.unlink(link, (err) => {
          if (err) {
            console.log(err);
            res.end();
          } else {
            res.end('file downloaded');
          }
        });
      } catch(e) {
        console.log(e);
      }
    }
  });
})


app.listen(3000, () => {
  console.log('running on port 3000');
});



function dlVid(src) {
  return new Promise((fulfill, reject) => {
    try {
      const dl = ytdl(src, {
        filter: 'audioonly'
      });
      dl.on('progress', (c, td, tdl) => {
        console.log(c, td, tdl);
      });
      dl.on('info', (info) => {
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



function processVideo(vid, full, name, start, end) {
  if (full) {
    start = 0;
  }
  console.log(start, end);
  return ffmpeg(vid)
    .noVideo()
    .audioCodec('libmp3lame')
    .audioBitrate(320)
    .seekInput(start)
    .duration(end - start)
    .output(`temp/${name}`);
}

