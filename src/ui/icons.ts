/**
 * Menu tile icons: small line drawings in the notebook style (DESIGN §6).
 * Lines use `currentColor` (the ink); the `.ico-a` parts are the red-pen
 * accent, coloured from CSS so every theme recolours them.
 */

export type IconId =
  | 'continue'
  | 'freeWrite'
  | 'daily'
  | 'fairCopy'
  | 'apprentice'
  | 'desk'
  | 'stickers'
  | 'words'
  | 'how'
  | 'settings'
  | 'saves'
  | 'about'
  | 'margin'
  | 'pageDone'
  | 'globe'
  | 'together';

const PATHS: Record<IconId, string> = {
  // A written page with a stopwatch: the typing-speed test.
  fairCopy:
    '<path d="M5 4h15v24H5z"/><path d="M9 10h7M9 15h7M9 20h4"/><circle class="ico-a" cx="23" cy="21" r="6"/><path class="ico-a" d="M23 18v3l2 1.5M21.5 13.5h3"/>',
  // A bookmark ribbon with an arrow: pick up where you left off.
  continue: '<path d="M8 4h13v24l-6.5-5L8 28z"/><path class="ico-a" d="M18 14h10m-4-4 4 4-4 4"/>',
  // A quill over a line of ink.
  freeWrite:
    '<path d="M27 4C16 5 9 12 7 24"/><path d="M27 4c-1 8-7 14-16 16"/><path d="M15 15l-3 3"/><path d="M7 24l-2 4"/><path class="ico-a" d="M13 28c3-1.5 6 1.5 9 0s4-1 5-.5"/>',
  // A calendar page with today ticked.
  daily: '<rect x="5" y="7" width="22" height="20" rx="3"/><path d="M5 13h22M11 4v6M21 4v6"/><path class="ico-a" d="M11 20l3.5 3.5L21 17"/>',
  // A mortarboard with its tassel.
  apprentice: '<path d="M3 12l13-6 13 6-13 6z"/><path d="M9 15v6c0 2 3 4 7 4s7-2 7-4v-6"/><path class="ico-a" d="M27 13v7l-1.5 3"/>',
  // A desk lamp shining down.
  desk: '<path d="M5 28h22"/><path d="M11 28l3-9 6-7"/><path d="M17 8l7-4 4 7-7 3z"/><path class="ico-a" d="M22 17l-1 3M26 16l1 3"/>',
  // A star sticker on a square sheet.
  stickers:
    '<rect x="4" y="4" width="24" height="24" rx="4"/><path class="ico-a" d="M16 8.5l2.3 4.8 5.2.7-3.8 3.6 1 5.2L16 20.3l-4.7 2.5 1-5.2-3.8-3.6 5.2-.7z"/>',
  // A list with red-pen bullets.
  words: '<path d="M12 9h14M12 16h14M12 23h10"/><path class="ico-a ico-dot" d="M6.5 9h.01M6.5 16h.01M6.5 23h.01"/>',
  // A question mark in a circle.
  how: '<circle cx="16" cy="16" r="12"/><path d="M12.5 12.5a3.5 3.5 0 1 1 4.5 3.4c-.8.3-1 1-1 2.1"/><path class="ico-a ico-dot" d="M16 22.5h.01"/>',
  // A cog: eight square teeth round a body, with a red hub.
  settings:
    '<path d="M13.2 6.9L13.5 3.7H18.5L18.8 6.9L20.4 7.6L22.9 5.6L26.4 9.1L24.4 11.6L25.1 13.2L28.3 13.5V18.5L25.1 18.8L24.4 20.4L26.4 22.9L22.9 26.4L20.4 24.4L18.8 25.1L18.5 28.3H13.5L13.2 25.1L11.6 24.4L9.1 26.4L5.6 22.9L7.6 20.4L6.9 18.8L3.7 18.5V13.5L6.9 13.2L7.6 11.6L5.6 9.1L9.1 5.6L11.6 7.6Z"/><circle class="ico-a" cx="16" cy="16" r="4"/>',
  // A save disk.
  saves: '<path d="M6 5h16l4 4v18H6z"/><path d="M11 5v6h10V5"/><path class="ico-a" d="M11 27v-7h10v7"/>',
  // Ruled lines with the red margin down the left.
  margin: '<rect x="5" y="4" width="22" height="24" rx="2"/><path d="M14 11h9M14 17h9M14 23h6"/><path class="ico-a" d="M10 4v24"/>',
  // A finished page with a tick.
  pageDone: '<path d="M8 4h12l5 5v19H8z"/><path d="M20 4v5h5"/><path class="ico-a" d="M11.5 18l3.5 3.5 6.5-7"/>',
  // A globe: languages, without picking a country's flag.
  globe: '<circle cx="16" cy="16" r="12"/><path d="M4.5 12h23M4.5 20h23"/><path class="ico-a" d="M16 4c-6 6.5-6 17.5 0 24M16 4c6 6.5 6 17.5 0 24"/>',
  // An "i" in a circle.
  // Two ink drops joined by a dotted line: playing together.
  together:
    '<path d="M9 5c-3.5 5-5.5 8-5.5 11a5.5 5.5 0 0 0 11 0C14.5 13 12.5 10 9 5z"/><path d="M23 11c-3 4.2-4.6 6.7-4.6 9.3a4.6 4.6 0 0 0 9.2 0c0-2.6-1.6-5.1-4.6-9.3z"/><path class="ico-a" stroke-dasharray="1.5 2.5" d="M8 25c3 3 9 4 13 1"/>',
  about: '<circle cx="16" cy="16" r="12"/><path d="M16 14.5v8"/><path class="ico-a ico-dot" d="M16 9.5h.01"/>',
};

/** An icon as an inline SVG string (decorative: the tile's label names it). */
export function iconSvg(id: IconId): string {
  return `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${PATHS[id]}</svg>`;
}
