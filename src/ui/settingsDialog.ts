/** Settings dialog: text size, colors, motion and sound (REQUIREMENTS §10). */
import './dialog.css';
import { t, type MessageKey } from '../i18n';
import { LAYOUT_IDS } from '../content/layouts';
import type { LayoutId } from '../content/layouts/types';
import { THEMES } from '../render/theme';
import { HOLIDAY_LOOKS, KEYBOARD_KINDS, MOTION_SETTINGS, PAGE_WRITING, SCREEN_EFFECTS, TEXT_SIZES, type Settings } from '../settings';
import { h, trapFocus } from './dom';
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '../core/languages';

export interface SettingsDialogOptions {
  settings: Settings;
  /** Called on every change, so the game can update immediately. */
  onChange(settings: Settings): void;
  onTestSound(): void;
  /** Tutorial tips for the current player (they live in the save, not in Settings). */
  tips?: { enabled: boolean; onToggle(enabled: boolean): void; onReset(): void };
  /** Forgiving accents for this player (in their save); left out for a words language without accents. */
  forgiving?: { enabled: boolean; onToggle(enabled: boolean): void };
  /** "Ready for more?" suggestions for this player (core/nudges.ts). */
  nudges?: { enabled: boolean; onToggle(enabled: boolean): void };
  /** The current player's keyboard layout (also in their save); left out while a page is in play. */
  layout?: { current: LayoutId; onPick(id: LayoutId): void };
  /** The current player's words language (in their save); left out while a page is in play. */
  wordsLanguage?: { current: Language; onPick(lang: Language): void };
  /** Open the dialog again, so a new menu language shows straight away. */
  reopen?(): void;
  onClose(): void;
}

let groupId = 0;

/** A labelled group of radio buttons. */
function radioGroup<T extends string>(
  legend: string,
  help: string,
  values: readonly T[],
  current: T,
  label: (value: T) => string,
  onPick: (value: T) => void,
): HTMLFieldSetElement {
  const name = `setting-${groupId++}`;
  return h('fieldset', { className: 'st-group' }, [
    h('legend', {}, [legend]),
    h(
      'div',
      { className: 'st-options' },
      values.map((value) => {
        const input = h('input', { type: 'radio', name, value, onChange: () => onPick(value) });
        input.checked = value === current;
        return h('label', { className: 'st-option' }, [input, h('span', {}, [label(value)])]);
      }),
    ),
    h('p', { className: 'st-help' }, [help]),
  ]);
}

/** "Show tips" and "Show all tips again", for the current player. */
function tipsGroup(tips: SettingsDialogOptions['tips']): HTMLElement | null {
  if (!tips) return null;
  const show = h('input', { type: 'checkbox', onChange: () => tips.onToggle(show.checked) });
  show.checked = tips.enabled;
  const status = h('p', { className: 'st-help', role: 'status', 'aria-live': 'polite' }, [t('settings.tips.help')]);
  return h('fieldset', { className: 'st-group' }, [
    h('legend', {}, [t('settings.tips')]),
    h('div', { className: 'st-options' }, [
      h('label', { className: 'st-option' }, [show, h('span', {}, [t('settings.tips.show')])]),
      h(
        'button',
        {
          type: 'button',
          className: 'tc-secondary',
          onClick: () => {
            tips.onReset();
            show.checked = true;
            status.textContent = t('settings.tips.resetDone');
          },
        },
        [t('settings.tips.reset')],
      ),
    ]),
    status,
  ]);
}

/** Forgiving accents (per player): a plain letter counts for its accented one. */
function forgivingGroup(forgiving: SettingsDialogOptions['forgiving']): HTMLElement | null {
  if (!forgiving) return null;
  const on = h('input', { type: 'checkbox', onChange: () => forgiving.onToggle(on.checked) });
  on.checked = forgiving.enabled;
  return h('fieldset', { className: 'st-group' }, [
    h('legend', {}, [t('settings.forgiving')]),
    h('div', { className: 'st-options' }, [h('label', { className: 'st-option' }, [on, h('span', {}, [t('settings.forgiving.show')])])]),
    h('p', { className: 'st-help' }, [t('settings.forgiving.help')]),
  ]);
}

function nudgesGroup(nudges: SettingsDialogOptions['nudges']): HTMLElement | null {
  if (!nudges) return null;
  const on = h('input', { type: 'checkbox', onChange: () => nudges.onToggle(on.checked) });
  on.checked = nudges.enabled;
  return h('fieldset', { className: 'st-group' }, [
    h('legend', {}, [t('settings.nudges')]),
    h('div', { className: 'st-options' }, [h('label', { className: 'st-option' }, [on, h('span', {}, [t('settings.nudges.show')])])]),
    h('p', { className: 'st-help' }, [t('settings.nudges.help')]),
  ]);
}

export function openSettings(host: HTMLElement, options: SettingsDialogOptions): { close(): void } {
  let settings = { ...options.settings };
  const previousFocus = document.activeElement as HTMLElement | null;

  const change = (patch: Partial<Settings>) => {
    settings = { ...settings, ...patch };
    options.onChange(settings);
  };

  const volume = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(settings.volume * 100),
    'aria-label': t('settings.volume'),
    onInput: () => change({ volume: Number(volume.value) / 100 }),
  });
  const mute = h('input', { type: 'checkbox', onChange: () => change({ muted: mute.checked }) });
  mute.checked = settings.muted;

  const panel = h('div', { className: 'tc-panel st-panel' }, [
    h('header', {}, [h('h2', { id: 'st-title' }, [t('settings.title')])]),
    radioGroup(
      t('settings.menuLanguage'),
      t('settings.menuLanguage.help'),
      LANGUAGES,
      settings.menuLanguage,
      (v) => LANGUAGE_NAMES[v],
      (menuLanguage) => {
        change({ menuLanguage });
        close();
        options.reopen?.();
      },
    ),
    radioGroup(
      t('settings.textSize'),
      t('settings.textSize.help'),
      TEXT_SIZES,
      settings.textSize,
      (v) => t(`settings.textSize.${v}` as MessageKey),
      (textSize) => change({ textSize }),
    ),
    radioGroup(
      t('settings.theme'),
      t('settings.theme.help'),
      THEMES,
      settings.theme,
      (v) => t(`settings.theme.${v}` as MessageKey),
      (theme) => change({ theme }),
    ),
    radioGroup(
      t('settings.motion'),
      t('settings.motion.help'),
      MOTION_SETTINGS,
      settings.motion,
      (v) => t(`settings.motion.${v}` as MessageKey),
      (motion) => change({ motion }),
    ),
    radioGroup(
      t('settings.screenEffects'),
      t('settings.screenEffects.help'),
      SCREEN_EFFECTS,
      settings.screenEffects,
      (v) => t(`settings.screenEffects.${v}` as MessageKey),
      (screenEffects) => change({ screenEffects }),
    ),
    radioGroup(
      t('settings.pageWriting'),
      t('settings.pageWriting.help'),
      PAGE_WRITING,
      settings.pageWriting,
      (v) => t(`settings.pageWriting.${v}` as MessageKey),
      (pageWriting) => change({ pageWriting }),
    ),
    radioGroup(
      t('settings.holidayLooks'),
      t('settings.holidayLooks.help'),
      HOLIDAY_LOOKS,
      settings.holidayLooks,
      (v) => t(`settings.holidayLooks.${v}` as MessageKey),
      (holidayLooks) => change({ holidayLooks }),
    ),
    radioGroup(
      t('settings.keyboardKind'),
      t('settings.keyboardKind.help'),
      KEYBOARD_KINDS,
      settings.keyboardKind,
      (v) => t(`settings.keyboardKind.${v}` as MessageKey),
      (keyboardKind) => change({ keyboardKind }),
    ),
    options.layout
      ? radioGroup(
          t('settings.layout'),
          t('settings.layout.help'),
          LAYOUT_IDS,
          options.layout.current,
          (v) => t(`layout.${v}` as MessageKey),
          (id) => options.layout?.onPick(id),
        )
      : null,
    options.wordsLanguage
      ? radioGroup(
          t('settings.wordsLanguage'),
          t('settings.wordsLanguage.help'),
          LANGUAGES,
          options.wordsLanguage.current,
          (v) => LANGUAGE_NAMES[v],
          (lang) => options.wordsLanguage?.onPick(lang),
        )
      : null,
    tipsGroup(options.tips),
    forgivingGroup(options.forgiving),
    nudgesGroup(options.nudges),
    h('fieldset', { className: 'st-group' }, [
      h('legend', {}, [t('settings.sound')]),
      h('div', { className: 'st-options' }, [
        h('label', { className: 'st-option st-volume' }, [h('span', {}, [t('settings.volume')]), volume]),
        h('label', { className: 'st-option' }, [mute, h('span', {}, [t('settings.mute')])]),
        h('button', { type: 'button', className: 'tc-secondary', onClick: () => options.onTestSound() }, [t('settings.test')]),
      ]),
    ]),
    h('footer', {}, [
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-primary', onClick: () => close() }, [t('settings.close')]),
      ]),
    ]),
  ]);

  const root = h('div', { className: 'dialog settings', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'st-title' }, [panel]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      trapFocus(root, event);
    }
  };

  function close() {
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
    previousFocus?.focus?.();
    options.onClose();
  }

  root.addEventListener('keydown', onKeyDown);
  host.append(root);
  root.querySelector<HTMLInputElement>('input:checked')?.focus();
  return { close };
}
