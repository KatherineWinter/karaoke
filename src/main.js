import {
  playAudioData,
  playAudioUrl,
  AudioState,
  setAudioState
} from './karaoke-audio.js'

(function () {
  'use strict';

  function init() {
    const filedrag = document.getElementById('filedrag'),
        fileselect = document.getElementById('fileselect'),
        disableFilter = document.getElementById('disable-filter'),
        options = document.getElementById('options'),
        demoAudio = document.getElementById('demo-audio');

    // file select
    fileselect.addEventListener('change', fileSelectHandler, false);

    var xhr = new XMLHttpRequest();
    if (xhr.upload) {
      // file drop
      filedrag.addEventListener('dragover', fileDragHover, false);
      filedrag.addEventListener('dragleave', fileDragHover, false);
      filedrag.addEventListener('drop', fileSelectHandler, false);
      filedrag.style.display = 'block';
    } else {
      filedrag.style.display = 'none';
    }

    disableFilter.addEventListener('change', function(e) {
      setAudioState(AudioState.KaraokeMode, e.target.checked)
    });

    demoAudio.addEventListener('click', function() {
      playAudioUrl('./resources/mmo-happy.mp3')
    }, false);
  }

  // file drag hover
  function fileDragHover(e) {
    e.stopPropagation();
    e.preventDefault();
    e.target.className = (e.type === 'dragover' ? 'hover' : '');
  }

  // file selection
  function fileSelectHandler(e) {
    // cancel event and hover styling
    fileDragHover(e);

    const droppedFiles = e.target.files || e.dataTransfer.files;

    const reader = new FileReader();

    reader.onload = function(fileEvent) {
      playAudioData(fileEvent.target.result)
      showData(this.result);
    };

    // http://ericbidelman.tumblr.com/post/8343485440/reading-mp3-id3-tags-in-javascript
    // https://github.com/jDataView/jDataView/blob/master/src/jDataView.js

    reader.readAsArrayBuffer(droppedFiles[0]);
  }

  function showData(file) {
    var currentSong = document.getElementById('current-song');
    var dv = new jDataView(file);

    try {
      // "TAG" starts at byte -128 from EOF.
      // See http://en.wikipedia.org/wiki/ID3
      if (dv.getString(3, dv.byteLength - 128) == 'TAG') {
        var title = dv.getString(30, dv.tell());
        var artist = dv.getString(30, dv.tell());
        var album = dv.getString(30, dv.tell());
        var year = dv.getString(4, dv.tell());
        currentSong.innerHTML = 'Playing ' + title + ' by ' + artist;
      } else {
        // no ID3v1 data found.
        currentSong.innerHTML = 'Playing';
      }
    } catch (e) {
      currentSong.innerHTML = 'Playing';
    }

    options.style.display = 'block';
  }

  // call initialization file
  if (window.File && window.FileList && window.FileReader) {
    init();
  } else {
    alert('Your browser does not support File');
  }

})();
