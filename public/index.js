$(document).ready(function() {
  $("#download-button").hide();
  $('.tooltip').tooltipster();
  
  $("#e-dig-form").on("submit", (e) => {
    e.preventDefault();
    const link = $("#youtube-link-input").val();
    const start = $("#video-begin-input").val();
    const end = $("#video-end-input").val();

    const c1 = start.replace(":", "")
    const c2 = end.replace(":", "")



    if (/^\d+$/.test(c1) || /^\d+$/.test(c2) ) {
      console.log('yes');
    } else {
      alert('please use only stringifed numbers in your start/end times');
      return;
    }

    requestSample({ link, start, end});
  });


  function requestSample(payload) {
    const { link, start, end } = payload;
    $.ajax({
      url: `/dig?src=${link}&start=${start}&end=${end}`,
      error: (err) => {
        console.log(err);
      },
      success: (resp) => {
        $("#download-button").fadeIn("slow");
        const link = $("#youtube-link-input").val('');
        const start = $("#video-begin-input").val('0:00');
        const end = $("#video-end-input").val('');
        const result = JSON.parse(resp);
        handleDownload(result.link);
      } 
    });
  }

  function handleDownload(link) {
    $("#download-button").click(() => {
      window.open(`/download?link=${link}`);
    });
  }
})
