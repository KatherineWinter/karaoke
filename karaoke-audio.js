let context = new (window.AudioContext || window.webkitAudioContext)()
let source;
let processor,
  filterLowPass,
  filterHighPass,
  karaokeGainNode,
  normalGainNode;
let startTime = null
let hasStarted = false

function copy(src) {
  if (!src) return null
  var dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
}

function createFilter (passType, src, ctx) {
  let pass = ctx.createBiquadFilter()
  src.connect(pass)
  pass.type = passType;
  pass.frequency.value = 120;
  return pass
}

function createGain (ctx) {
  let gainNode = ctx.createGain()
  gainNode.connect(ctx.destination);
  return gainNode
}

function createAudio(options = {}) {
  if (options.start < 0) {
    return `Invalid start value: ${options.start}`
  }

  if (options.duration && options.duration < 0) {
    return `Invalid duration value: ${options.duration}`
  }

  filterLowPass = createFilter('lowpass', source, context)
  filterHighPass = createFilter('highpass', source, context)

  // create the gain node
  karaokeGainNode = createGain(context);
  normalGainNode = createGain(context);

  // create the processor
  processor = context.createScriptProcessor(
    2048 /*bufferSize*/,
    2 /*num inputs*/,
    1 /*num outputs*/
  )

  // connect everything
  source.connect(normalGainNode);
  filterHighPass.connect(processor);
  filterLowPass.connect(karaokeGainNode);
  processor.connect(karaokeGainNode);

  // connect with the karaoke filter
  processor.onaudioprocess = karaoke

  startTime = new Date()
  source.start(0, options.start || 0, options.duration);
  hasStarted = true
}

function disconnect() {
  if (!hasStarted) return
  setAudioState(AudioState.KaraokeMode, false)
  source.stop(0);
  source.disconnect(0);
  processor.disconnect(0);
  karaokeGainNode.disconnect(0);
  normalGainNode.disconnect(0);
  filterHighPass.disconnect(0);
  filterLowPass.disconnect(0);
  hasStarted = false
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
      if (karaokeGainNode) karaokeGainNode.gain.value = enabled ? 1 : 0;
      if (normalGainNode) normalGainNode.gain.value = enabled ? 0 : 1;
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
        .then(resolve)

    request.send();
  })
}

export function songLength() {
  return source && source.buffer ? source.buffer.duration : -1
}

export function playAudioData(data, options = {}) {
  return new Promise((resolve, reject) => {
    const copyData = copy(data)
    if (!copyData || !copyData.byteLength) {
      reject('data is invalid')
      return
    }

    try {
      context.resume()
      if (source) disconnect()
      source = context.createBufferSource();

      if (context.decodeAudioData) {
        context.decodeAudioData(copyData, (buffer) => {
          source.buffer = buffer
          const error = createAudio(options)
          if (error) {
            reject(error)
            return
          }

          resolve({
            decodedBuffer: source.buffer
          })
        }, e => {
          reject(e)
          return
        });
      } else {
        source.buffer = context.createBuffer(copyData, false)
        const error = createAudio(options)
        if (error) {
          reject(error)
          return
        }

        resolve({
          decodedBuffer: source.buffer
        })
      }
    } catch (e) {
      reject(e)
      return
    }
  })
}
