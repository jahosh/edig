$(document).ready(function() {
  $("#download-button").hide();


  $('.tooltip').tooltipster({
    side: 'left',
  });


  $("#e-dig-form").on("submit", (e) => {
    e.preventDefault();
    const link = $("#youtube-link-input").val();
    const start = $("#video-begin-input").val();
    const end = $("#video-end-input").val();

    if (link === '') {
      alert('must submit a link');
      return;
    }

    const c1 = start.replace(":", "")
    const c2 = end.replace(":", "")

    const sTime = msToSecondsOnly(start);
    const eTime = msToSecondsOnly(end);


    if (/^\d+$/.test(c1) || /^\d+$/.test(c2) ) {
      console.log('yes');
    } else {
      alert('please use only stringifed numbers in your start/end times');
      return;
    }

    requestSample({ link, sTime, eTime});
  });


  function requestSample(payload) {
    const { link, sTime, eTime } = payload;
    $.ajax({
      url: `/dig?src=${link}&start=${sTime}&end=${eTime}`,
      error: (err) => {
        console.log(err);
      },
      success: (resp) => {
        $("#download-button").fadeIn("slow");
        const link = $("#youtube-link-input").val('');
        const start = $("#video-begin-input").val('0:00');
        const end = $("#video-end-input").val('');
        console.log(resp);
        const result = JSON.parse(resp);
        showInfo(result.title);
        handleDownload(result.link);
      } 
    });
  }

  function handleDownload(link) {
    console.log('this is link', `/download?link=${link}`);
    $("#download-button").click(() => {
      window.open(`/download?link=${link}`);
      $("#download-button").hide();
      location.reload();
    });
  }

  function showInfo(title) {
    $("#track-title").append(title);
  }

  function msToSecondsOnly(str) {
    var p = str.split(':'),
      s = 0, m = 1;

    while (p.length > 0) {
      s += m * parseInt(p.pop(), 10);
      m *= 60;
    }

    return s;
  }
})
