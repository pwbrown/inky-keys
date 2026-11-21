/**
 * A small card in the corner when stickers are earned. It doesn't take the
 * keyboard, so play goes on; screen readers hear it through a live region.
 */
import './dialog.css';
import './stickers.css';
import { formatNumber, tCount } from '../i18n';
import { h } from './dom';

export interface ToastSticker {
  emoji: string;
  name: string;
  group: string;
}

/** A sticker's round picture. */
export function stickerArt(emoji: string, group: string): HTMLSpanElement {
  return h('span', { className: `sticker-art sticker-${group}`, 'aria-hidden': 'true' }, [emoji]);
}

let current: HTMLElement | null = null;

export function showStickerToast(host: HTMLElement, stickers: readonly ToastSticker[], ms = 4500): void {
  if (stickers.length === 0) return;
  current?.remove();
  const toast = h('div', { className: 'sticker-toast', role: 'status', 'aria-live': 'polite' }, [
    h('span', { className: 'sticker-toast-title' }, [
      tCount('stickers.toast', stickers.length, { count: formatNumber(stickers.length) }),
    ]),
    ...stickers.map((s) => h('span', { className: 'sticker-toast-row' }, [stickerArt(s.emoji, s.group), s.name])),
  ]);
  host.append(toast);
  current = toast;
  window.setTimeout(() => {
    toast.classList.add('sticker-toast-leaving');
    window.setTimeout(() => toast.remove(), 320);
  }, ms);
}
