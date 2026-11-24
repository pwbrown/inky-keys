/**
 * The Type Case: the key-selection screen (REQUIREMENTS §5, DESIGN §4).
 *
 * Plain DOM rather than PixiJS (REQUIREMENTS §7), so it works with screen
 * readers and keyboard navigation. Each key cap has two buttons: its Shift
 * character on top and its plain character below.
 */
import './dialog.css';
import type { KeyboardLayout, LayoutKey } from '../content/layouts/types';
import {
  regionsFor,
  matchingPreset,
  orderedSelection,
  regionChars,
  regionState,
  strippedAccents,
  toggleRegion,
  type Preset,
} from '../core/keySelection';
import { catchUpKeys, keyAccuracy, masteryLevel, masteryProgress, suggestNextKeys, type KeyCounts } from '../core/mastery';
import { formatNumber, t, tCount, type MessageKey } from '../i18n';
import { handsArt } from '../render/handsArt';
import { artElement } from './art';
import { h } from './dom';

export interface TypeCaseOptions {
  layout: KeyboardLayout;
  builtInPresets: readonly Preset[];
  customPresets: readonly Preset[];
  /** Currently selected characters. */
  initial: readonly string[];
  /** Saved per-key hits and misses, for mastery display and suggestions. */
  keyStats: Readonly<Record<string, KeyCounts>>;
  /** Number of dictionary words the keys can make. */
  countWords(keys: readonly string[]): number;
  /** Below this many words, warn that made-up strings will be mixed in. */
  minWords: number;
  onDone(keys: string[]): void;
  onCancel(): void;
  /** Save the current selection as a named preset. Returns the new preset. */
  onSavePreset(name: string, keys: string[]): Preset;
  onDeletePreset(id: string): void;
  /** The words language's accented letters this player can type (core/accents.ts), for the Accents group and strip. */
  accents?: readonly string[];
  /** Open the accent help card. */
  onAccentHelp?(): void;
}

export interface TypeCaseHandle {
  close(): void;
}

/** What the player sees on a key cap. */
export function capLabel(ch: string): string {
  return ch === ' ' ? t('typeCase.space') : ch;
}

export function presetName(preset: Preset): string {
  return preset.builtIn && !preset.name ? t(`preset.${preset.id}` as MessageKey) : (preset.name ?? '');
}

export function openTypeCase(host: HTMLElement, options: TypeCaseOptions): TypeCaseHandle {
  const { layout } = options;
  const accents = options.accents ?? [];
  let selection = new Set(options.initial);
  let custom = [...options.customPresets];
  const previousFocus = document.activeElement as HTMLElement | null;

  /** Every character button, for refreshing their pressed state. */
  const charButtons = new Map<string, HTMLButtonElement[]>();
  const regionButtons = new Map<string, HTMLButtonElement>();

  const summary = h('p', { className: 'tc-summary', 'aria-live': 'polite' });
  const warning = h('p', { className: 'tc-warning', 'aria-live': 'polite' });
  const presetList = h('div', { className: 'tc-chips', role: 'group', 'aria-label': t('typeCase.presets') });
  const customList = h('div', { className: 'tc-chips', role: 'group', 'aria-label': t('typeCase.yourPresets') });
  const customSection = h('div', { className: 'tc-custom' });
  const doneButton = h('button', { type: 'button', className: 'tc-primary', onClick: () => done() }, [t('typeCase.done')]);
  const nameInput = h('input', {
    type: 'text',
    className: 'tc-name',
    maxlength: 40,
    placeholder: t('typeCase.savePlaceholder'),
    'aria-label': t('typeCase.savePlaceholder'),
  });

  const set = (next: Set<string>) => {
    selection = next;
    refresh();
  };

  const toggleChar = (ch: string) => {
    const next = new Set(selection);
    if (next.has(ch)) next.delete(ch);
    else next.add(ch);
    set(next);
  };

  // --- Key caps ---------------------------------------------------------------

  const charButton = (ch: string, part: 'base' | 'shift' | 'solo') => {
    const stat = options.keyStats[ch];
    const level = masteryLevel(stat);
    const mastery = t(`mastery.${level}` as MessageKey);
    const button = h(
      'button',
      {
        type: 'button',
        className: `tc-char tc-${part}`,
        'data-mastery': level,
        'aria-label': t('typeCase.key', { char: capLabel(ch), mastery }),
        title: t('typeCase.keyStats', {
          char: capLabel(ch),
          hits: formatNumber(stat?.hits ?? 0),
          accuracy: formatNumber(Math.round(keyAccuracy(stat) * 100)),
          mastery,
        }),
        onClick: () => toggleChar(ch),
      },
      [capLabel(ch)],
    );
    // Ink fill for the practice bar (DESIGN §4).
    button.style.setProperty('--fill', masteryProgress(stat).toFixed(3));
    const list = charButtons.get(ch) ?? [];
    list.push(button);
    charButtons.set(ch, list);
    return button;
  };

  const keyCap = (key: LayoutKey) => {
    const cap = h('div', { className: 'tc-key' });
    if (key.width) cap.style.flexGrow = String(key.width);
    if (key.shift) cap.append(charButton(key.shift, 'shift'));
    cap.append(charButton(key.base, key.shift ? 'base' : 'solo'));
    return cap;
  };

  const suggestion = h('div', { className: 'tc-suggest', 'aria-live': 'polite' });
  /** "Not now": no more suggestions until the Type Case opens again. */
  let suggestionsOff = false;

  const keyboard = h(
    'div',
    { className: `tc-keyboard tc-${layout.physical}`, role: 'group', 'aria-label': t('typeCase.keyboard', { layout: t(`layout.${layout.id}` as MessageKey) }) },
    layout.rows.map((row, i) => h('div', { className: `tc-row tc-row-${i}` }, row.map(keyCap))),
  );

  // Accented letters with no key of their own (ê on AZERTY, every accent on a US
  // keyboard), so they can be picked too, with a link to how they're typed.
  const stripChars = strippedAccents(layout, accents);
  const accentStrip =
    stripChars.length === 0
      ? null
      : h('div', { className: 'tc-accent-strip', role: 'group', 'aria-label': t('typeCase.accentStrip') }, [
          h('span', { className: 'tc-strip-label' }, [t('typeCase.accentStrip')]),
          h('div', { className: 'tc-strip-keys' }, stripChars.map((ch) => h('div', { className: 'tc-key' }, [charButton(ch, 'solo')]))),
          options.onAccentHelp
            ? h('button', { type: 'button', className: 'menu-link tc-strip-help', onClick: () => options.onAccentHelp?.() }, [t('contents.accentsHelp')])
            : null,
        ]);

  // --- Regions and presets -------------------------------------------------

  const regions = h(
    'div',
    { className: 'tc-chips', role: 'group', 'aria-label': t('typeCase.groups') },
    regionsFor(layout, accents).map((region) => {
      const chars = regionChars(layout, region, accents);
      const button = h(
        'button',
        { type: 'button', className: 'tc-chip', onClick: () => set(toggleRegion(selection, chars)) },
        [t(`region.${region}` as MessageKey)],
      );
      regionButtons.set(region, button);
      return button;
    }),
  );

  const presetChip = (preset: Preset) =>
    h('button', { type: 'button', className: 'tc-chip', 'data-preset': preset.id, onClick: () => set(new Set(preset.chars)) }, [
      presetName(preset),
    ]);

  for (const preset of options.builtInPresets) presetList.append(presetChip(preset));

  const renderCustom = () => {
    customList.replaceChildren(
      ...custom.map((preset) =>
        h('span', { className: 'tc-custom-chip' }, [
          presetChip(preset),
          h(
            'button',
            {
              type: 'button',
              className: 'tc-delete',
              'aria-label': t('typeCase.delete', { name: presetName(preset) }),
              onClick: () => {
                options.onDeletePreset(preset.id);
                custom = custom.filter((p) => p.id !== preset.id);
                renderCustom();
                refresh();
              },
            },
            ['×'],
          ),
        ]),
      ),
    );
    customSection.hidden = custom.length === 0;
  };

  const saveForm = h(
    'form',
    {
      className: 'tc-save',
      onSubmit: (event) => {
        event.preventDefault();
        const name = nameInput.value.trim();
        if (!name || selection.size === 0) return;
        custom = [...custom, options.onSavePreset(name, orderedSelection(layout, selection))];
        nameInput.value = '';
        renderCustom();
        refresh();
      },
    },
    [nameInput, h('button', { type: 'submit', className: 'tc-secondary' }, [t('typeCase.save')])],
  );

  customSection.append(h('h3', {}, [t('typeCase.yourPresets')]), customList);

  // --- Layout ---------------------------------------------------------------

  const panel = h('div', { className: 'tc-panel' }, [
    h('header', {}, [h('h2', { id: 'tc-title' }, [t('typeCase.title')]), h('p', { className: 'tc-intro' }, [t('typeCase.intro')])]),
    h('section', {}, [h('h3', {}, [t('typeCase.presets')]), presetList, customSection]),
    suggestion,
    h('div', {}, [
      keyboard,
      accentStrip,
      h('p', { className: 'tc-legend' }, [t('typeCase.legend'), ' ', t('typeCase.layoutNote', { layout: t(`layout.${layout.id}` as MessageKey) })]),
    ]),
    h('section', {}, [h('h3', {}, [t('typeCase.groups')]), regions]),
    h('footer', {}, [
      h('div', { className: 'tc-status' }, [summary, warning]),
      saveForm,
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-secondary', onClick: () => set(new Set()) }, [t('typeCase.clear')]),
        h('button', { type: 'button', className: 'tc-secondary', onClick: () => cancel() }, [t('typeCase.cancel')]),
        doneButton,
      ]),
    ]),
  ]);

  const root = h('div', { className: 'dialog type-case', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tc-title' }, [panel]);

  // --- State → DOM ----------------------------------------------------------

  function refresh() {
    for (const [ch, buttons] of charButtons) {
      for (const button of buttons) button.setAttribute('aria-pressed', String(selection.has(ch)));
    }
    for (const region of regionsFor(layout, accents)) {
      const state = regionState(selection, regionChars(layout, region, accents));
      regionButtons.get(region)?.setAttribute('aria-pressed', state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false');
    }
    const active = matchingPreset([...options.builtInPresets, ...custom], selection);
    for (const chip of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.preset === active?.id));
    }

    const keys = [...selection];
    const words = options.countWords(keys);
    summary.textContent = t('typeCase.summary', { keys: formatNumber(keys.length), words: formatNumber(words) });
    warning.textContent =
      keys.length === 0
        ? t('typeCase.warnEmpty')
        : words === 0
          ? t('typeCase.warnNoWords')
          : words < options.minWords
            ? t('typeCase.warnFewWords')
            : '';
    doneButton.disabled = keys.length === 0;

    // Apprentice path: suggest the next keys once these are mostly mastered.
    const ordered = orderedSelection(layout, selection);
    const next = suggestionsOff ? [] : suggestNextKeys(layout, ordered, options.keyStats);
    // Keys already known from other pages can all go in at once.
    const catchUp = next.length === 0 ? [] : catchUpKeys(layout, ordered, options.keyStats);
    suggestion.hidden = next.length === 0;
    const hadFocus = suggestion.contains(document.activeElement);
    suggestion.replaceChildren(
      ...(next.length === 0
        ? []
        : [
            artElement(
              handsArt(layout, next, {
                ink: 'var(--tc-ink)',
                paper: 'var(--tc-paper)',
                hand: 'color-mix(in srgb, var(--tc-ink) 13%, var(--tc-paper))',
                highlight: 'var(--tc-highlight)',
                margin: 'var(--tc-margin)',
                rim: 'var(--tc-ink-light)',
              }).svg,
              'tc-hands',
            ),
            h('p', {}, [t('typeCase.suggest', { keys: next.map(capLabel).join(' + ') })]),
            h('div', { className: 'tc-suggest-actions' }, [
              h('button', { type: 'button', className: 'tc-secondary', onClick: () => set(new Set([...selection, ...next])) }, [
                t('typeCase.suggestAdd'),
              ]),
              catchUp.length > next.length
                ? h('button', { type: 'button', className: 'tc-secondary', onClick: () => set(new Set([...selection, ...catchUp])) }, [
                    tCount('typeCase.catchUp', catchUp.length),
                  ])
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'tc-suggest-later',
                  onClick: () => {
                    suggestionsOff = true;
                    refresh();
                  },
                },
                [t('typeCase.suggestLater')],
              ),
            ]),
          ]),
    );
    // Keep focus in the box when it shows the next round, or move it on when it goes.
    if (hadFocus) (suggestion.querySelector('button') ?? doneButton).focus();
  }

  // --- Keyboard -------------------------------------------------------------

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === 'Tab') {
      trapFocus(event);
      return;
    }
    // Pressing a key on the real keyboard toggles it, unless typing a preset name
    // or pressing Space/Enter to activate a focused button.
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if ((event.key === ' ' || event.key === 'Enter') && target instanceof HTMLButtonElement) return;
    if ([...event.key].length === 1 && (selection.has(event.key) || charButtons.has(event.key))) {
      event.preventDefault();
      toggleChar(event.key);
    }
  };

  function trapFocus(event: KeyboardEvent) {
    const focusable = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), input')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close() {
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
    previousFocus?.focus?.();
  }

  function done() {
    if (selection.size === 0) return;
    close();
    options.onDone(orderedSelection(layout, selection));
  }

  function cancel() {
    close();
    options.onCancel();
  }

  root.addEventListener('keydown', onKeyDown);
  renderCustom();
  refresh();
  host.append(root);
  (presetList.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? presetList.querySelector('button'))?.focus();

  return { close };
}
