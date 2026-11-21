/**
 * How to type an accented letter, drawn as numbered keycaps: "1 press ^
 * (it waits), 2 press e = ê" (core/accents.ts). Used by the accent chapters'
 * opening card, the just-in-time briefing and the accent help card. The keys
 * press themselves in turn; with reduced motion the steps just stand still.
 */
import './keySteps.css';
import type { KeyStep } from '../core/accents';
import { t } from '../i18n';
import { h } from './dom';

/** Names of the modifier keys, as printed on keyboards in the menu language. */
function modifiers(step: KeyStep): string[] {
  return [step.option ? t('keycap.option') : null, step.altGr ? t('keycap.altGr') : null, step.shift ? t('keycap.shift') : null].filter(
    (m): m is string => m !== null,
  );
}

/** A key as printed: A–Z in capitals, like on a keyboard (AZERTY prints é, ç, à in lowercase). */
function capLabel(key: string): string {
  return /^[a-z]$/.test(key) ? key.toUpperCase() : key;
}

/** One step's keys in words, for screen readers: "Shift + 6". */
export function stepText(step: KeyStep): string {
  return [...modifiers(step), capLabel(step.key)].join(' + ');
}

/**
 * The steps for one letter. `size` 'large' is the teaching card (animated
 * unless reduced motion is on); 'small' is a row in the help card.
 */
export function keyStepsView(char: string, steps: readonly KeyStep[], size: 'large' | 'small' = 'large'): HTMLElement {
  const label = t('accent.stepsLabel', { char, steps: steps.map(stepText).join(t('accent.then')) });
  return h('div', { className: `ks ks-${size}`, role: 'img', 'aria-label': label, style: `--ks-steps: ${steps.length}` }, [
    h('span', { className: 'ks-target', 'aria-hidden': 'true' }, [char]),
    h('span', { className: 'ks-equals', 'aria-hidden': 'true' }, ['=']),
    h(
      'ol',
      { className: 'ks-steps', 'aria-hidden': 'true' },
      steps.map((step, i) =>
        h('li', { className: `ks-step${step.dead ? ' ks-dead' : ''}`, style: `--ks-i: ${i}` }, [
          h('span', { className: 'ks-num' }, [String(i + 1)]),
          h('span', { className: 'ks-keys' }, [
            ...modifiers(step).flatMap((m) => [h('kbd', { className: 'ks-cap ks-mod' }, [m]), h('span', { className: 'ks-plus' }, ['+'])]),
            h('kbd', { className: `ks-cap${step.top ? ' ks-two' : ''}` }, [
              step.top ? h('span', { className: 'ks-top' }, [step.top]) : null,
              h('span', { className: 'ks-base' }, [capLabel(step.key)]),
            ]),
          ]),
          h('span', { className: 'ks-makes' }, [step.dead ? t('accent.waits', { mark: step.makes }) : step.makes]),
        ]),
      ),
    ),
  ]);
}
