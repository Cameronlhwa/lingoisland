export function pcmToWav(chunks: Float32Array[], sourceRate: number): Blob {
  const targetRate = 16_000;
  const inputLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (inputLength === 0) throw new Error("No microphone audio was captured.");
  const input = new Float32Array(inputLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    input.set(chunk, offset);
    offset += chunk.length;
  });
  let peak = 0;
  let squaredSum = 0;
  for (let index = 0; index < input.length; index += 1) {
    const sample = input[index];
    peak = Math.max(peak, Math.abs(sample));
    squaredSum += sample * sample;
  }
  const rms = Math.sqrt(squaredSum / inputLength);
  if (rms < 0.001) {
    throw new Error("The microphone signal was silent. Check the selected input device and try again.");
  }
  // SpeechSuper rejects quiet but otherwise valid WAV files. Normalize the
  // captured PCM before encoding while preserving headroom to prevent clipping.
  const gain = 0.85 / peak;
  const outputLength = Math.ceil((inputLength * targetRate) / sourceRate);
  const pcm = new Int16Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = Math.min(Math.floor((index * sourceRate) / targetRate), inputLength - 1);
    const sample = Math.max(-1, Math.min(1, (input[sourceIndex] ?? 0) * gain));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const wav = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(wav);
  const write = (writeOffset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(writeOffset + index, value.charCodeAt(index));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Int16Array(wav, 44).set(pcm);
  return new Blob([wav], { type: "audio/wav" });
}

export type PcmRecorderHandle = {
  stream: MediaStream;
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
};

/**
 * Starts raw PCM capture via getUserMedia + a ScriptProcessorNode. Callers own
 * the returned handle and must call stopPcmRecording() to tear it down and
 * get back an encoded WAV blob.
 */
export async function startPcmRecording(): Promise<PcmRecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      autoGainControl: true,
      noiseSuppression: true,
      echoCancellation: false,
    },
  });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(audioContext.destination);
  await audioContext.resume();
  return { stream, audioContext, source, processor, chunks };
}

/** Tears down a handle from startPcmRecording() and returns the encoded WAV blob. */
export function stopPcmRecording(handle: PcmRecorderHandle): Blob {
  handle.processor.disconnect();
  handle.source.disconnect();
  const wav = pcmToWav(handle.chunks, handle.audioContext.sampleRate);
  void handle.audioContext.close();
  handle.stream.getTracks().forEach((track) => track.stop());
  return wav;
}

/** Tears down a handle without encoding — used for unmount/error cleanup. */
export function abortPcmRecording(handle: PcmRecorderHandle) {
  handle.processor.disconnect();
  handle.source.disconnect();
  void handle.audioContext.close();
  handle.stream.getTracks().forEach((track) => track.stop());
}
