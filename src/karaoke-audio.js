let context = new (window.AudioContext || window.webkitAudioContext)()
let source;
let processor,
  filterLowPass,
  filterHighPass,
  mix,
  mix2;
let startTime = null

function copy(src) {
  if (!src) return null
  var dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
}

function createAudio(options = {}) {
  // create low-pass filter
  filterLowPass = context.createBiquadFilter();
  source.connect(filterLowPass);

  filterLowPass.type = 'lowpass';
  filterLowPass.frequency.value = 120;

  // create high-pass filter
  filterHighPass = context.createBiquadFilter();
  source.connect(filterHighPass);
  filterHighPass.type = 'highpass';
  filterHighPass.frequency.value = 120;

  // create the gain node
  mix = context.createGain();

  mix2 = context.createGain();
  source.connect(mix2);
  mix2.connect(context.destination);

  // create the processor
  processor = context.createScriptProcessor(
    2048 /*bufferSize*/,
    2 /*num inputs*/,
    1 /*num outputs*/
  )

  // connect everything
  filterHighPass.connect(processor);
  filterLowPass.connect(mix);
  processor.connect(mix);
  mix.connect(context.destination);

  // connect with the karaoke filter
  processor.onaudioprocess = karaoke

  startTime = new Date()
  source.start(0, options.start || 0, options.duration);

  setTimeout(disconnect, source.buffer.duration * 1000 + 1000);
}

function disconnect() {
  setAudioState(AudioState.KaraokeMode, false)
  source.stop(0);
  source.disconnect(0);
  processor.disconnect(0);
  mix.disconnect(0);
  mix2.disconnect(0);
  filterHighPass.disconnect(0);
  filterLowPass.disconnect(0);
}

// based on https://gist.github.com/kevincennis/3928503
// flip phase of right channel
// http://www.soundonsound.com/sos/sep04/articles/qa0904-7.htm
function karaoke(evt) {
  let inputL = evt.inputBuffer.getChannelData(0),
    inputR = evt.inputBuffer.getChannelData(1),
    output = evt.outputBuffer.getChannelData(0),
    len = inputL.length,
    i = 0;
  for (; i < len; i++) {
    output[i] = inputL[i] - inputR[i];
  }
}

export const AudioState = {
  Start: 'start',
  Running: 'running',
  KaraokeMode: 'karaokeMode'
}

export function audioState() {
  return context.state
}

export function currentTime() {
  const currentTime = new Date();
  return startTime ? (currentTime - startTime) * 0.001 : -1
}

export function setAudioState(option, enabled) {
  switch (option) {
    case AudioState.Running:
      enabled ? context.resume() : context.suspend()
      break

    case AudioState.Start:
      if (source && !enabled) disconnect()
      break

    case AudioState.KaraokeMode:
      mix.gain.value = enabled ? 1 : 0;
      mix2.gain.value = enabled ? 0 : 1;
      break

    default:
      console.error('unknown audio option: ' + option)
      break
  }
}

export function playAudioUrl(url, options = {}) {
  return new Promise((resolve) => {
    let request = new XMLHttpRequest();

    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
  
    request.onload = () =>
      playAudioData(request.response, options)
  
    request.send();
  })
}

export function songLength() {
  return source && source.buffer ? source.buffer.duration : -1
}

export function playAudioData(data, options = {}) {
  return new Promise((resolve) => {
    const copyData = copy(data)
    if (!copyData || !copyData.byteLength) {
      throw new Error('data is invalid')
    }
  
    try {
      if (source) disconnect()
      source = context.createBufferSource();
  
      if (context.decodeAudioData) {
        context.decodeAudioData(copyData, (buffer) => {
          source.buffer = buffer
          createAudio(options)
        }, e => {
          throw new Error(e)
        });
      } else {
        source.buffer = context.createBuffer(copyData, false);
        createAudio(options);
      }

      setTimeout(resolve, 2000)
      resolve()
    } catch (e) {
      throw new Error(e)
    }
  })
}
