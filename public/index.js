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

  const socket = io.connect();
  const nanobar = new Nanobar();
  socket.on('progress', (progress) => {
    nanobar.go(progress);
  });
  $(".sample-player").toggle();
  $("#download-button").hide();
  let currentPage = getUrlParameter('page');
  let totalPages = $("#total-pages").text();


  if (!currentPage || currentPage === '0') {
    //add disabled class to prev arrow - this means we are on homepage
    $("#prev").addClass('disabled');
    $("#prev").removeClass('arrows');
    $(`.0`).addClass('active-page');
  } else {
    // set the current page as active
    $("#first-page").toggle();
    $(`.${currentPage}`).addClass('active-page');
  }


  if (currentPage === totalPages) {
    $("#next").addClass('disabled');
    $("#next").removeClass('arrows');
    $("#next").attr("title", "end of the road!");
    $(`${totalPages}`).addClass('active-page');
  }


  $("#next").on('click', () => {
    if ($("#next").hasClass('disabled')) {
      return;
    }
    const page = getUrlParameter('page');
    fetchMoreSamples(Number(page) + 1);
  });

  $("#prev").on('click', () => {
    if ($("#prev").hasClass('disabled')) {
      return;
    }
    const page = getUrlParameter('page');
    fetchMoreSamples(Number(page) - 1);
  });

  $('.tooltip').tooltipster({
  });

  $("#search-icon").on("click", () => {
    $("#search-div").toggle("slow");
  })

  $(".download-sample-btn").on("click", (e) => {
    const sample = e.target.attributes[1].nodeValue;
    const url = $(`.full-title-${sample}`).text();
    window.open(`/download?link=${url}&slug=true`);
  });

  $(".like-sample-btn").on("click", (e) => {
    const sampleId = e.target.attributes[2].nodeValue;
    const cookies = document.cookie.split(" ");

    if (cookies.includes(`_yts-like-${sampleId}=true;`) || cookies.includes(`_yts-like-${sampleId}=true`)) {
      alert('you already liked this');
      return;
    }

    $.post({
      url: `/like/${sampleId}`,
      error: (err) => {
        console.log(err);
      },
      success: (resp) => {
        let likes = $(`#total-likes-${sampleId}`).text();
        let newTotal = Number(likes) + 1;
        $(`#total-likes-${sampleId}`).text(`${newTotal}`);
        $(`#thumbs-up-${sampleId}`).addClass('liked');
      }
    });
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
    const category = $("#category-input").val();

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

    if (start === '0' && end === '0' && !full) {
      alert('start & end cannot both be 0');
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
    requestSample({ link, sTime, eTime, full, category });
  });


  function requestSample(payload) {
    const { link, sTime, eTime, full, category } = payload;

    toggleInputs(true);
    $("#error").empty().toggle();

    $.ajax({
      url: `/dig?src=${link}&category=${category}&start=${sTime}&end=${eTime}&full=${full}`,
      error: (err) => {
        // append error msg
        $("#error").fadeIn("slow");
        $("#error").append(err.responseJSON.error);
        $("#loading").fadeOut("slow");
        $("#submit").toggle();
        toggleInputs(false);
      },
      success: (resp) => {
        console.log(resp);
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

  function fetchMoreSamples(page) {
    window.location.href = `https://ytsampler.com/?page=${page}`;
  }

  function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  function search(term) {
    $.ajax({
      url: `/search/?term=${term}`,
      error: (err) => {
        console.log(err);
      },
      success: (resp) => {
        renderSearchResults(resp);
      }
    });
  }

  function renderSearchResults(results) {
    $("#search-results-count").text(results.length);
    results.forEach((result) => {
      $("#sample-list").append(`
        <li class="sample-card">
          <div class="sample-stats">
            <span class="sample-number">#${result.id}</span>
            <span class="sample-date">${result.created_at}</span>
            <br />
            <div class="sample-title">
              <a href="${result.src}" class="sample-link" target="_blank">
                ${result.title.substring(0, 25)}
              </a>
              <span style="display:none;" class="full-title-<%= sample.id %>"><%= sample.sample_src %></span>
            </div>
          </div>
          <div class="sample-image">
              <img  src="${result.thumbnail}" /> 
            </div>

        </li>
      `)
    })
  }
});
