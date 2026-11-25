/**
 * Hands microphone audio to the page in small blocks, for sound pairing
 * (src/net/sound.ts). Runs in the AudioWorklet scope; audio never leaves the
 * device.
 */

// The AudioWorklet scope's globals, which the DOM lib doesn't describe.
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(inputs: Float32Array[][]): boolean;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

class Recorder extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}

registerProcessor('inky-recorder', Recorder);
