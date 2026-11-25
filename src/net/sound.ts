/**
 * Sound pairing (REQUIREMENTS §13e): plays a handshake code through the
 * speaker, or listens for one with the microphone. The modem itself is in
 * core/net/modem.ts.
 *
 * Privacy: the microphone is opened only while the player has Listen on, and
 * its audio is decoded on this device and thrown away; nothing is recorded or
 * sent anywhere.
 */
import { GAME_CONFIG } from '../core/config';
import { ModemListener, modulate } from '../core/net/modem';
import recorderUrl from './recorder.worklet.ts?worker&url';

export const soundSupported = (): boolean =>
  typeof AudioContext === 'function' && typeof AudioWorkletNode === 'function' && !!navigator.mediaDevices?.getUserMedia;

/** Plays `bytes` a few times over. Resolves when done; `stop()` ends early. */
export function playCode(bytes: Uint8Array): { done: Promise<void>; stop(): void } {
  const context = new AudioContext();
  const { repeats, gapMs } = GAME_CONFIG.net.sound;
  const frame = modulate(bytes, context.sampleRate);
  const gap = Math.round((gapMs / 1000) * context.sampleRate);
  const buffer = context.createBuffer(1, repeats * (frame.length + gap), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < repeats; i++) data.set(frame, i * (frame.length + gap));
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  const done = new Promise<void>((resolve) => {
    source.onended = () => {
      void context.close();
      resolve();
    };
  });
  void context.resume().then(() => source.start());
  return { done, stop: () => source.stop() };
}

/**
 * Listens for frames until `stop()`; each frame heard goes to `onFrame`
 * (the caller checks it, e.g. with the handshake's CRC). Rejects if the
 * microphone can't be used (the player said no, or there isn't one).
 */
export async function listenForCodes(onFrame: (bytes: Uint8Array) => void): Promise<{ stop(): void }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // The browser's voice processing would treat the tones as noise to remove.
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule(recorderUrl);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    void context.close();
    throw error;
  }
  const source = context.createMediaStreamSource(stream);
  const recorder = new AudioWorkletNode(context, 'inky-recorder');
  const listener = new ModemListener(context.sampleRate);
  recorder.port.onmessage = (e: MessageEvent<Float32Array>) => {
    for (const frame of listener.push(e.data)) onFrame(frame);
  };
  source.connect(recorder);
  // Some browsers only run nodes that lead to the speakers: connect through silence.
  const silence = context.createGain();
  silence.gain.value = 0;
  recorder.connect(silence).connect(context.destination);
  await context.resume();
  return {
    stop: () => {
      recorder.port.onmessage = null;
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
}
