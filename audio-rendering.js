// https://stackoverflow.com/questions/22073716/create-a-waveform-of-the-full-track-with-web-audio-api
export function displayAudioBufferLevel(options = {}) {
  const { decodedAudioBuffer, canvasElId, startSecond, endSecond, fillColor } = options
  let canvas = document.getElementById(canvasElId);
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  let context = canvas.getContext('2d');
  var leftChannel = decodedAudioBuffer.getChannelData(0); // Float32Array describing left channel
  context.save();
  context.fillStyle = fillColor;
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.strokeStyle = '#121';
  context.globalCompositeOperation = 'lighter';
  context.translate(0, canvasHeight / 2);
  context.globalAlpha = 0.06; // lineOpacity ;
  let i = startSecond * decodedAudioBuffer.sampleRate//0
  let count = (endSecond * decodedAudioBuffer.sampleRate) + 1//leftChannel.length
  for (i = 0; i < count; ++i) {
    // on which line do we get ?
    var x = Math.floor(canvasWidth * i / count);
    var y = leftChannel[i] * canvasHeight / 2;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 1, y);
    context.stroke();
  }
  context.restore();
}

// https://stackoverflow.com/questions/22073716/create-a-waveform-of-the-full-track-with-web-audio-api
export function displayAudioBufferLevel2(options = {}) {
  const { decodedAudioBuffer, canvasElId, startSecond, endSecond, fillColor } = options
  let canvas = document.getElementById(canvasElId);
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  let context = canvas.getContext('2d');
  const leftChannel = decodedAudioBuffer.getChannelData(0); // Float32Array describing left channel       
  // we 'resample' with cumul, count, variance
  // Offset 0 : PositiveCumul  1: PositiveCount  2: PositiveVariance
  //        3 : NegativeCumul  4: NegativeCount  5: NegativeVariance
  // that makes 6 data per bucket
  const ResampleIndex = {
    PositiveCumul: 0,
    PositiveCount: 1,
    PositiveVariance: 2,
    NegativeCumul: 3,
    NegativeCount: 4,
    NegativeVariance: 5,
    BucketCount: 6,
  }
  let resampled = new Float64Array(canvasWidth * ResampleIndex.BucketCount);
  let i = 0, j = 0, buckIndex = 0;
  let min = 1e3, max = -1e3;
  let thisValue = 0;
  const startI = startSecond * decodedAudioBuffer.sampleRate
  const endI = (endSecond * decodedAudioBuffer.sampleRate) + 1
  const sampleCount = endI
  // first pass for mean
  for (i = startI; i < sampleCount; i++) {
    // in which bucket do we fall ?
    buckIndex = 0 | (canvasWidth * i / sampleCount);
    buckIndex *= ResampleIndex.BucketCount;
    // positive or negative ?
    thisValue = leftChannel[i];
    if (thisValue > 0) {
      resampled[buckIndex] += thisValue;
      resampled[buckIndex + ResampleIndex.PositiveCount] += 1;
    } else if (thisValue < 0) {
      resampled[buckIndex + ResampleIndex.NegativeCumul] += thisValue;
      resampled[buckIndex + ResampleIndex.NegativeCount] += 1;
    }
    if (thisValue < min) min = thisValue;
    if (thisValue > max) max = thisValue;
  }
  // compute mean now
  for (i = 0, j = 0; i < canvasWidth; i++ , j += ResampleIndex.BucketCount) {
    if (resampled[j + ResampleIndex.PositiveCount] !== 0) {
      resampled[j] /= resampled[j + ResampleIndex.PositiveCount];
    }
    if (resampled[j + ResampleIndex.NegativeCount] !== 0) {
      resampled[j + ResampleIndex.NegativeCumul] /= resampled[j + ResampleIndex.NegativeCount];
    }
  }
  // second pass for mean variation  ( variance is too low)
  for (i = startI; i < endI; i++) {
    // in which bucket do we fall ?
    buckIndex = 0 | (canvasWidth * i / endI);
    buckIndex *= ResampleIndex.BucketCount;
    // positive or negative ?
    thisValue = leftChannel[i];
    if (thisValue > 0) {
      resampled[buckIndex + ResampleIndex.PositiveVariance] += Math.abs(resampled[buckIndex] - thisValue);
    } else if (thisValue < 0) {
      resampled[buckIndex + ResampleIndex.NegativeVariance] += Math.abs(resampled[buckIndex + ResampleIndex.NegativeCumul] - thisValue);
    }
  }
  // compute mean variation/variance now
  for (i = 0, j = 0; i < canvasWidth; i++ , j += ResampleIndex.BucketCount) {
    if (resampled[j + ResampleIndex.PositiveCount]) resampled[j + ResampleIndex.PositiveVariance] /= resampled[j + ResampleIndex.PositiveCount];
    if (resampled[j + ResampleIndex.NegativeCount]) resampled[j + ResampleIndex.NegativeVariance] /= resampled[j + ResampleIndex.NegativeCount];
  }
  context.save();
  context.fillStyle = fillColor;
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.translate(0.5, canvasHeight / 2);
  context.scale(ResampleIndex.PositiveCount, 200);

  for (i = 0; i < canvasWidth; i++) {
    j = i * ResampleIndex.BucketCount;
    // draw from positiveAvg - variance to negativeAvg - variance 
    context.strokeStyle = '#F00';
    context.beginPath();
    context.moveTo(i, (resampled[j] - resampled[j + ResampleIndex.PositiveVariance]));
    context.lineTo(i, (resampled[j + ResampleIndex.NegativeCumul] + resampled[j + ResampleIndex.NegativeVariance]));
    context.stroke();
    // draw from positiveAvg - variance to positiveAvg + variance 
    context.strokeStyle = '#FFF';
    context.beginPath();
    context.moveTo(i, (resampled[j] - resampled[j + ResampleIndex.PositiveVariance]));
    context.lineTo(i, (resampled[j] + resampled[j + ResampleIndex.PositiveVariance]));
    context.stroke();
    // draw from negativeAvg + variance to negativeAvg - variance 
    // context.strokeStyle = '#FFF';
    context.beginPath();
    context.moveTo(i, (resampled[j + ResampleIndex.NegativeCumul] + resampled[j + ResampleIndex.NegativeVariance]));
    context.lineTo(i, (resampled[j + ResampleIndex.NegativeCumul] - resampled[j + ResampleIndex.NegativeVariance]));
    context.stroke();
  }
  context.restore();
}
