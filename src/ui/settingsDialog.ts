/**
 * Settings dialog (REQUIREMENTS §10), in three tabs: language and keyboard,
 * look and sound, help and hints.
 */
import './dialog.css';
import { t, type MessageKey } from '../i18n';
import { LAYOUT_IDS, suggestedLayout } from '../content/layouts';
import type { LayoutId } from '../content/layouts/types';
import { THEMES } from '../render/theme';
import { HOLIDAY_LOOKS, KEYBOARD_KINDS, MOTION_SETTINGS, PAGE_WRITING, SCREEN_EFFECTS, TEXT_SIZES, type Settings } from '../settings';
import { h, trapFocus } from './dom';
import { iconSvg } from './icons';
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '../core/languages';

export const SETTINGS_TABS = ['language', 'look', 'help'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export interface SettingsDialogOptions {
  settings: Settings;
  /** The tab to open on; otherwise the one last used. */
  tab?: SettingsTab;
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
/** The tab last shown, so the dialog opens where the player left it. */
let lastTab: SettingsTab = 'language';
/** A language just picked, carried over when the dialog reopens in it, for the layout hint. */
let pickedLanguage: Language | null = null;

/** A down or up chevron, for the "more to scroll" arrows. */
function chevron(dir: 'up' | 'down'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.innerHTML = `<path d="${dir === 'down' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'}"/>`;
  return svg;
}

/** A legend with the globe before it, so the language settings can be found in any menu language. */
function globeLegend(text: string): HTMLLegendElement {
  const legend = h('legend', { className: 'st-globe-legend' });
  const icon = h('span', { className: 'st-globe' });
  icon.innerHTML = iconSvg('globe');
  legend.append(icon, text);
  return legend;
}

/** A labelled group of radio buttons. */
function radioGroup<T extends string>(
  legend: string | HTMLLegendElement,
  help: string,
  values: readonly T[],
  current: T,
  label: (value: T) => string,
  onPick: (value: T) => void,
): HTMLFieldSetElement {
  const name = `setting-${groupId++}`;
  return h('fieldset', { className: 'st-group' }, [
    typeof legend === 'string' ? h('legend', {}, [legend]) : legend,
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

  // --- Language & keyboard ---------------------------------------------------

  let currentLayout = options.layout?.current;
  const layoutGroup = options.layout
    ? radioGroup(
        t('settings.layout'),
        t('settings.layout.help'),
        LAYOUT_IDS,
        options.layout.current,
        (v) => t(`layout.${v}` as MessageKey),
        (id) => pickLayout(id),
      )
    : null;
  const layoutHint = h('div', { className: 'st-hint', 'aria-live': 'polite' });
  layoutHint.hidden = true;

  function pickLayout(id: LayoutId) {
    currentLayout = id;
    options.layout?.onPick(id);
    const input = layoutGroup?.querySelector<HTMLInputElement>(`input[value="${id}"]`);
    if (input) input.checked = true;
    layoutHint.hidden = true;
    layoutHint.replaceChildren();
  }

  /** After a language is picked, offer the keyboard most people use for it. */
  function showLayoutHint(lang: Language) {
    const suggestion = currentLayout ? suggestedLayout(lang, currentLayout) : null;
    layoutHint.hidden = suggestion === null;
    if (!suggestion) {
      layoutHint.replaceChildren();
      return;
    }
    const layoutName = t(`layout.${suggestion}` as MessageKey);
    layoutHint.replaceChildren(
      h('p', {}, [t('settings.layoutHint', { language: LANGUAGE_NAMES[lang], layout: layoutName })]),
      h('button', { type: 'button', className: 'tc-secondary', onClick: () => pickLayout(suggestion) }, [
        t('settings.layoutHint.switch', { layout: layoutName }),
      ]),
    );
  }

  const languagePanel = [
    radioGroup(
      globeLegend(t('settings.menuLanguage')),
      t('settings.menuLanguage.help'),
      LANGUAGES,
      settings.menuLanguage,
      (v) => LANGUAGE_NAMES[v],
      (menuLanguage) => {
        change({ menuLanguage });
        pickedLanguage = menuLanguage;
        close();
        options.reopen?.();
      },
    ),
    options.wordsLanguage
      ? radioGroup(
          globeLegend(t('settings.wordsLanguage')),
          t('settings.wordsLanguage.help'),
          LANGUAGES,
          options.wordsLanguage.current,
          (v) => LANGUAGE_NAMES[v],
          (lang) => {
            options.wordsLanguage?.onPick(lang);
            showLayoutHint(lang);
          },
        )
      : null,
    layoutGroup,
    layoutHint,
    radioGroup(
      t('settings.keyboardKind'),
      t('settings.keyboardKind.help'),
      KEYBOARD_KINDS,
      settings.keyboardKind,
      (v) => t(`settings.keyboardKind.${v}` as MessageKey),
      (keyboardKind) => change({ keyboardKind }),
    ),
    forgivingGroup(options.forgiving),
  ];
  if (pickedLanguage) showLayoutHint(pickedLanguage);
  pickedLanguage = null;

  // --- Look & sound -----------------------------------------------------------

  const lookPanel = [
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
    h('fieldset', { className: 'st-group' }, [
      h('legend', {}, [t('settings.sound')]),
      h('div', { className: 'st-options' }, [
        h('label', { className: 'st-option st-volume' }, [h('span', {}, [t('settings.volume')]), volume]),
        h('label', { className: 'st-option' }, [mute, h('span', {}, [t('settings.mute')])]),
        h('button', { type: 'button', className: 'tc-secondary', onClick: () => options.onTestSound() }, [t('settings.test')]),
      ]),
    ]),
  ];

  // --- Help & hints -------------------------------------------------------------

  const helpPanel = [tipsGroup(options.tips), nudgesGroup(options.nudges)];

  // --- Tabs ---------------------------------------------------------------------

  const contents: Record<SettingsTab, (HTMLElement | null)[]> = { language: languagePanel, look: lookPanel, help: helpPanel };
  const tabs = new Map<SettingsTab, HTMLButtonElement>();
  const panels = new Map<SettingsTab, HTMLElement>();
  for (const id of SETTINGS_TABS) {
    const tab = h('button', {
      type: 'button',
      role: 'tab',
      id: `st-tab-${id}`,
      className: 'st-tab',
      'aria-controls': `st-panel-${id}`,
      onClick: () => select(id),
    });
    if (id === 'language') {
      const icon = h('span', { className: 'st-globe' });
      icon.innerHTML = iconSvg('globe');
      tab.append(icon);
    }
    tab.append(t(`settings.tab.${id}` as MessageKey));
    tabs.set(id, tab);
    panels.set(id, h('div', { role: 'tabpanel', id: `st-panel-${id}`, className: 'st-tabpanel', 'aria-labelledby': `st-tab-${id}` }, contents[id]));
  }

  function select(id: SettingsTab, focus = false) {
    lastTab = id;
    for (const [tabId, tab] of tabs) {
      const on = tabId === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels.get(tabId)!.hidden = !on;
    }
    scroller.scrollTop = 0;
    updateArrows();
    if (focus) tabs.get(id)?.focus();
  }

  const tabList = h('div', { role: 'tablist', className: 'st-tabs', 'aria-label': t('settings.title') }, [...tabs.values()]);
  tabList.addEventListener('keydown', (event) => {
    const i = SETTINGS_TABS.indexOf(lastTab);
    const n = SETTINGS_TABS.length;
    const next =
      event.key === 'ArrowRight' ? (i + 1) % n : event.key === 'ArrowLeft' ? (i - 1 + n) % n : event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : -1;
    if (next === -1) return;
    event.preventDefault();
    select(SETTINGS_TABS[next]!, true);
  });

  // The tabs scroll inside a box of fixed height, so the tab bar never moves.
  // Arrows at the top and bottom bob while there's more to scroll to.
  const scroller = h('div', { className: 'st-scroll' }, [...panels.values()]);
  const moreArrow = (dir: 'up' | 'down') =>
    h('div', { className: `st-more st-more-${dir}`, 'aria-hidden': 'true', onClick: () => scroller.scrollBy({ top: (dir === 'up' ? -1 : 1) * scroller.clientHeight * 0.8, behavior: 'smooth' }) }, [
      chevron(dir),
    ]);
  const upArrow = moreArrow('up');
  const downArrow = moreArrow('down');
  const updateArrows = () => {
    upArrow.hidden = scroller.scrollTop <= 2;
    downArrow.hidden = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
    // Fade the edge that has more beyond it.
    scroller.classList.toggle('st-fade-top', !upArrow.hidden);
    scroller.classList.toggle('st-fade-bottom', !downArrow.hidden);
  };
  scroller.addEventListener('scroll', updateArrows, { passive: true });
  const resize = new ResizeObserver(updateArrows);
  resize.observe(scroller);
  // A tab's content can grow too (the layout hint), changing what's left to scroll.
  for (const tabPanel of panels.values()) resize.observe(tabPanel);

  const panel = h('div', { className: 'tc-panel st-panel' }, [
    h('header', {}, [h('h2', { id: 'st-title' }, [t('settings.title')])]),
    tabList,
    h('div', { className: 'st-body' }, [scroller, upArrow, downArrow]),
    h('footer', {}, [
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-primary', onClick: () => close() }, [t('settings.close')]),
      ]),
    ]),
  ]);
  select(options.tab ?? lastTab);

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
    resize.disconnect();
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
    previousFocus?.focus?.();
    options.onClose();
  }

  root.addEventListener('keydown', onKeyDown);
  host.append(root);
  tabs.get(lastTab)?.focus();
  return { close };
}
