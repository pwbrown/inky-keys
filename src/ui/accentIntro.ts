/**
 * The card that opens an accent chapter, or meets an accent that hasn't been
 * taught yet (REQUIREMENTS §13d): each new letter with its numbered,
 * animated key steps. A DOM dialog, like the briefings, so screen readers
 * read it. Enter, Esc or the button starts the page.
 */
import './dialog.css';
import './unlock.css';
import './briefing.css';
import './accentHelp.css';
import type { KeyStep } from '../core/accents';
import { t } from '../i18n';
import { h, trapFocus } from './dom';
import { keyStepsView } from './keySteps';

export interface AccentIntroOptions {
  title: string;
  /** A line under the title, e.g. "New on this page". */
  intro: string;
  letters: readonly { char: string; steps: readonly KeyStep[] | null }[];
  onHelp(): void;
  /** The start button's label (default "Got it"). */
  startLabel?: string;
  /** `start` is true for Enter or the button, false for Esc (go back). */
  onClose(start: boolean): void;
}

function letterView(letter: AccentIntroOptions['letters'][number] | undefined, size: 'large' | 'small'): HTMLElement | null {
  if (!letter) return null;
  return letter.steps ? keyStepsView(letter.char, letter.steps, size) : h('p', {}, [letter.char, ' ', t('accents.cantType')]);
}

export function openAccentIntro(host: HTMLElement, options: AccentIntroOptions): { close(): void } {
  const previousFocus = document.activeElement as HTMLElement | null;
  const panel = h('div', { className: 'tc-panel ul-panel bf-panel ai-panel' }, [
    h('h2', { id: 'ai-title' }, [options.title]),
    h('p', { className: 'tc-intro' }, [options.intro]),
    // The first letter large and animated; the rest of the chapter's letters, which
    // mostly share its accent key, as a compact list underneath.
    h('div', { className: 'bf-card ai-card' }, [letterView(options.letters[0], 'large')]),
    options.letters.length > 1
      ? h('ul', { className: 'ai-more' }, options.letters.slice(1).map((letter) => h('li', {}, [letterView(letter, 'small')])))
      : null,
    h('div', { className: 'tc-actions bf-actions' }, [
      h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'help', onClick: () => options.onHelp() }, [t('contents.accentsHelp')]),
      h('button', { type: 'button', className: 'tc-primary', 'data-id': 'start', onClick: () => close(true) }, [options.startLabel ?? t('tutorial.start')]),
    ]),
  ]);

  const root = h('div', { className: 'dialog unlock briefing accent-intro', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ai-title' }, [panel]);
  let closed = false;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement && event.target.dataset.id === 'help'))) {
      event.preventDefault();
      event.stopPropagation();
      close(event.key === 'Enter');
    } else if (event.key === 'Tab') {
      trapFocus(root, event);
    }
  };
  function close(start: boolean) {
    if (closed) return;
    closed = true;
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
    previousFocus?.focus?.();
    options.onClose(start);
  }
  root.addEventListener('keydown', onKeyDown);
  host.append(root);
  root.querySelector<HTMLButtonElement>('[data-id="start"]')?.focus();
  return { close: () => close(false) };
}
