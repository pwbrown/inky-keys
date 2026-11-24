/** Every keyboard layout Inky Keys knows (REQUIREMENTS §11). */
import { COLEMAK } from './colemak';
import { DVORAK } from './dvorak';
import { ES_ISO } from './es-iso';
import { FR_AZERTY } from './fr-azerty';
import type { KeyboardLayout, LayoutId, LayoutKey, Platform } from './types';
import type { Language } from '../../core/languages';
import { US_QWERTY } from './us-qwerty';

export { charAt, deadKeyMark, findDeadKey, findKey, findKeyLevel, isDeadLevel } from './ansi';

export const LAYOUTS: readonly KeyboardLayout[] = [US_QWERTY, DVORAK, COLEMAK, FR_AZERTY, ES_ISO];

export const LAYOUT_IDS: readonly LayoutId[] = LAYOUTS.map((l) => l.id);

/** The layout most keyboards use for each words or menu language. */
export const HOME_LAYOUTS: Readonly<Record<Language, LayoutId>> = { en: 'us-qwerty', fr: 'fr-azerty', es: 'es-iso' };

/**
 * The layout to suggest after switching to `lang`: its home layout, but only
 * when the player is on another language's home layout (someone on Dvorak or
 * Colemak chose it on purpose).
 */
export function suggestedLayout(lang: Language, current: LayoutId): LayoutId | null {
  const home = HOME_LAYOUTS[lang];
  if (home === current) return null;
  return Object.values(HOME_LAYOUTS).includes(current) ? home : null;
}

/** New players start on US QWERTY. */
export const DEFAULT_LAYOUT_ID: LayoutId = 'us-qwerty';

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && (LAYOUT_IDS as readonly string[]).includes(value);
}

/**
 * The layout as it is on one kind of computer. A Mac has Option instead of
 * AltGr, with different characters, so the AltGr levels are left out there
 * (only the plain and Shift levels are shown and taught); keys listed in
 * `mac` type something else.
 */
export function forPlatform(layout: KeyboardLayout, platform: Platform): KeyboardLayout {
  if (platform === 'pc') return layout;
  const overrides = layout.mac ?? {};
  const onMac = (key: LayoutKey): LayoutKey => {
    const { dead, ...rest } = key;
    delete rest.altGr;
    delete rest.altGrShift;
    const plainDead = dead?.filter((level) => level === 'base' || level === 'shift');
    const next: LayoutKey = { ...rest, ...(plainDead?.length ? { dead: plainDead } : {}), ...overrides[key.code] };
    if (next.dead && next.dead.length === 0) delete next.dead;
    return next;
  };
  return { ...layout, rows: layout.rows.map((row) => row.map(onMac)) };
}

let platform: Platform = 'pc';
const cache = new Map<string, KeyboardLayout>();

/** Which kind of computer the player has (settings.keyboardKind): layoutById gives that variant. */
export function setLayoutPlatform(next: Platform): void {
  if (next === platform) return;
  platform = next;
  cache.clear();
}

/** The layout with this id (for the player's kind of computer), or US QWERTY for an unknown one. */
export function layoutById(id: string): KeyboardLayout {
  const layout = LAYOUTS.find((l) => l.id === id) ?? US_QWERTY;
  let out = cache.get(layout.id);
  if (!out) {
    out = forPlatform(layout, platform);
    cache.set(layout.id, out);
  }
  return out;
}

export { COLEMAK, DVORAK, ES_ISO, FR_AZERTY, US_QWERTY };
