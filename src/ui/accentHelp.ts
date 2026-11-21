/**
 * The accent help card (REQUIREMENTS §13d): every accented letter of the
 * player's words language, with the keys for their layout and computer.
 * Opened from How to play, the Type Case, the pause menu and every accent hint.
 */
import './dialog.css';
import './unlock.css';
import './accentHelp.css';
import { ACCENT_CHAPTERS, accentMethod, howToType } from '../core/accents';
import type { Language } from '../core/languages';
import type { KeyboardLayout, Platform } from '../content/layouts/types';
import { t, type MessageKey } from '../i18n';
import { h, trapFocus } from './dom';
import { keyStepsView } from './keySteps';

export interface AccentHelpOptions {
  lang: Language;
  /** The player's layout, as it is on their computer (layoutById). */
  layout: KeyboardLayout;
  platform: Platform;
  onClose(): void;
}

export function openAccentHelp(host: HTMLElement, options: AccentHelpOptions): { close(): void } {
  const previousFocus = document.activeElement as HTMLElement | null;
  const { layout, platform } = options;
  const method = accentMethod(layout, platform);

  const rows = ACCENT_CHAPTERS[options.lang].map((letters) =>
    h(
      'li',
      { className: 'ah-group' },
      letters.map((char) => {
        const steps = howToType(char, layout, platform);
        return h('div', { className: 'ah-letter' }, [
          steps ? keyStepsView(char, steps, 'small') : h('span', { className: 'ah-none' }, [char, ' ', t('accents.cantType')]),
        ]);
      }),
    ),
  );

  const panel = h('div', { className: 'tc-panel ul-panel ah-panel' }, [
    h('h2', { id: 'ah-title' }, [t('accents.title')]),
    h('p', { className: 'tc-intro' }, [t(`accents.intro.${method}` as MessageKey, { layout: t(`layout.${layout.id}` as MessageKey) })]),
    method === 'usInternational'
      ? h('details', { className: 'ah-setup' }, [
          h('summary', {}, [t('accents.setup.title')]),
          h('p', {}, [t('accents.setup.windows')]),
          h('p', {}, [t('accents.setup.chromebook')]),
          h('p', {}, [t('accents.setup.plain')]),
        ])
      : null,
    h('ul', { className: 'ah-groups' }, rows),
    h('p', { className: 'st-help ah-forgiving' }, [t('accents.forgivingNote')]),
    h('div', { className: 'tc-actions' }, [
      h('button', { type: 'button', className: 'tc-primary', 'data-id': 'close', onClick: () => close() }, [t('accents.close')]),
    ]),
  ]);

  const root = h('div', { className: 'dialog unlock accent-help', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ah-title' }, [panel]);
  let closed = false;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      trapFocus(root, event);
    }
  };

  function close() {
    if (closed) return;
    closed = true;
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
    previousFocus?.focus?.();
    options.onClose();
  }

  root.addEventListener('keydown', onKeyDown);
  host.append(root);
  root.querySelector<HTMLButtonElement>('[data-id="close"]')?.focus();
  return { close };
}
