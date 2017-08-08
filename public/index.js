$(document).ready(function() {
  var opts = {
    lines: 13 // The number of lines to draw
    , length: 28 // The length of each line
    , width: 14 // The line thickness
    , radius: 42 // The radius of the inner circle
    , scale: .2 // Scales overall size of the spinner
    , corners: 1 // Corner roundness (0..1)
    , color: '#000' // #rgb or #rrggbb or array of colors
    , opacity: 0.25 // Opacity of the lines
    , rotate: 0 // The rotation offset
    , direction: 1 // 1: clockwise, -1: counterclockwise
    , speed: 0.7 // Rounds per second
    , trail: 60 // Afterglow percentage
    , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
    , zIndex: 2e9 // The z-index (defaults to 2000000000)
    , className: 'spinner' // The CSS class to assign to the spinner
    , top: '50%' // Top position relative to parent
    , left: '50%' // Left position relative to parent
    , shadow: false // Whether to render a shadow
    , hwaccel: false // Whether to use hardware acceleration
    , position: 'absolute' // Element positioning
  }
  
  var socket = io.connect();
  const nanobar = new Nanobar();

  socket.on('progress', (progress) => {
    nanobar.go(progress);
  });
  
  $("#download-button").hide();

  $('.tooltip').tooltipster({
    side: 'left',
  });

  $("#full-song-input").click(() => {
    let toggle = true;
    if ($("#full-song-input").is(":checked")) {
      toggleTimeInputs(toggle);
    } else {
      toggle = false;
      toggleTimeInputs(toggle);
    }
  });

  $("#e-dig-form").on("submit", (e) => {
    e.preventDefault();

    const link = $("#youtube-link-input").val();
    let start = $("#video-begin-input").val();
    let end = $("#video-end-input").val();
    let full;

    if (!link.includes("www.youtube.com")) {
      alert('must be a url from youtube');
      return;
    }

    if ($("#full-song-input").is(":checked")) {
      full = true;
    }

    if (link === '') {
      alert('must submit a link');
      return;
    }

    if (!full && !start && !end) {
      alert('must enter times');
      return;
    }

    if (!start && !end) {
      start = "0";
      end = "0";
    }

    const sTime = msToSecondsOnly(start);
    const eTime = msToSecondsOnly(end);

    if (/^\d+$/.test(sTime) || /^\d+$/.test(eTime) || full ) {
    } else {
      alert('please use only stringifed numbers in your start/end times');
      return;
    }

    if (sTime > eTime) {
      alert('invalid times, start time must be before end time')
      return;
    }

    const target = document.getElementById('loading')
    const spinner = new Spinner(opts).spin(target);
    $("#submit").hide();
    requestSample({ link, sTime, eTime, full });
  });


  function requestSample(payload) {
    const { link, sTime, eTime, full } = payload;


    toggleInputs(true);
    $.ajax({
      url: `/dig?src=${link}&start=${sTime}&end=${eTime}&full=${full}`,
      error: (err) => {
        console.log(err);
      },
      success: (resp) => {
        const result = JSON.parse(resp);

        $("#loading").fadeOut("slow");
        $("#download-button").fadeIn("slow");
        $("#next-button").fadeIn("slow");
        $("#next-button").click(() => {
          location.reload();
        });

        const link = $("#youtube-link-input").val('');
        const start = $("#video-begin-input").val('0:00');
        const end = $("#video-end-input").val('');


        showInfo(result.title, result.thumbnail);
        handleDownload(result.link);
      } 
    });
  }

  function handleDownload(link) {
    $("#download-button").click(() => {
      window.open(`/download?link=${link}`);
      $("#download-button").hide();
      location.reload();
      $("#submit").toggle();
      $("#download-button").toggle();
    });
  }

  function showInfo(title, thumbnail) {
    $("#track-title").text(title);
    $("#track-image").html(`<img src='${thumbnail}' />`);
  };

  function msToSecondsOnly(str) {
    let p = str.split(':')
    let s = 0
    let m = 1;

    while (p.length > 0) {
      s += m * parseInt(p.pop(), 10);
      m *= 60;
    }
    return s;
  }

  function toggleInputs(flag) {
    $("#youtube-link-input").prop('disabled', flag);
    $("#video-begin-input").prop('disabled', flag);
    $("#video-end-input").prop('disabled', flag);
  }

  function toggleTimeInputs(flag) {
    $("#video-begin-input").prop('disabled', flag);
    $("#video-end-input").prop('disabled', flag);
  }

});
