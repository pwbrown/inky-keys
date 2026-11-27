/**
 * QR pairing (REQUIREMENTS §13e): reads a handshake link from the camera.
 * The decoder (jsQR) is loaded only when a player presses Scan.
 *
 * Privacy: the camera is on only while the scanner is open. Frames are read
 * on this device and thrown away; nothing is recorded or sent anywhere.
 */
import { GAME_CONFIG } from '../core/config';

export const scanSupported = (): boolean => !!navigator.mediaDevices?.getUserMedia;

/**
 * Shows the camera in `video` and reads QR codes until `stop()`; each one
 * read goes to `onText` (the caller checks it). Rejects if the camera can't
 * be used (the player said no, or there isn't one).
 */
export async function scanCodes(video: HTMLVideoElement, onText: (text: string) => void): Promise<{ stop(): void }> {
  const [{ default: jsQR }, stream] = await Promise.all([
    import('jsqr'),
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
  ]);
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  let timer = 0;
  const tick = () => {
    if (stopped) return;
    const { videoWidth: w, videoHeight: h } = video;
    if (context && w > 0 && h > 0) {
      canvas.width = w;
      canvas.height = h;
      context.drawImage(video, 0, 0, w, h);
      const found = jsQR(context.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (found?.data) onText(found.data);
    }
    if (!stopped) timer = window.setTimeout(tick, GAME_CONFIG.net.scanIntervalMs);
  };
  tick();
  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    },
  };
}
