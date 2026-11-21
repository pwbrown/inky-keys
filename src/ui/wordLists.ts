/**
 * Word lists dialog: download topic vocabulary on request and manage saved
 * lists (REQUIREMENTS §6, optional vocabulary fetch). The privacy note sits
 * right next to the button, so it's clear what gets sent before anything is.
 */
import './dialog.css';
import { VOCAB_API_ORIGINS, VocabError, fetchTopicWords, type Dictionary } from '../content/vocabApi';
import type { Language } from '../core/languages';
import type { Blocklist } from '../content/blocklist';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { VocabList } from '../storage/schema';
import { h, trapFocus } from './dom';

export interface WordListsOptions {
  lists: readonly VocabList[];
  /** The word pack, to pick an article's words from. */
  dictionary: Dictionary;
  blocklist: Blocklist;
  /** How many of these words the player's keys can type. */
  countFitting(words: readonly string[]): number;
  onAdd(list: VocabList): void;
  onToggle(id: string, enabled: boolean): void;
  onDelete(id: string): void;
  onClose(): void;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  /** The player's words language: which Wikipedia is asked, and which lists are shown. */
  lang?: Language;
}

export function openWordLists(host: HTMLElement, options: WordListsOptions): { close(): void } {
  const lang = options.lang ?? 'en';
  // Lists in other words languages stay saved, but only this language's are shown and used.
  let lists = options.lists.filter((l) => l.lang === lang);
  const previousFocus = document.activeElement as HTMLElement | null;

  const status = h('p', { className: 'sd-status', role: 'status', 'aria-live': 'polite' });
  const listBox = h('div', { className: 'wl-lists' });
  const input = h('input', {
    type: 'text',
    className: 'tc-name',
    maxlength: 40,
    placeholder: t('vocab.placeholder'),
    'aria-label': t('vocab.topic'),
  });
  const button = h('button', { type: 'submit', className: 'tc-primary' }, [t('vocab.download')]);

  const renderLists = () => {
    if (lists.length === 0) {
      listBox.replaceChildren(h('p', { className: 'sd-message' }, [t('vocab.none')]));
      return;
    }
    listBox.replaceChildren(
      ...lists.map((list) => {
        const toggle = h('input', {
          type: 'checkbox',
          'aria-label': t('vocab.use', { topic: list.topic }),
          onChange: () => {
            options.onToggle(list.id, toggle.checked);
            lists = lists.map((l) => (l.id === list.id ? { ...l, enabled: toggle.checked } : l));
          },
        });
        toggle.checked = list.enabled;
        return h('div', { className: 'wl-row' }, [
          h('label', { className: 'st-option' }, [toggle, h('strong', {}, [list.topic])]),
          h('span', { className: 'wl-count' }, [
            t('vocab.counts', {
              words: formatNumber(list.words.length),
              fit: formatNumber(options.countFitting(list.words)),
            }),
          ]),
          h(
            'button',
            {
              type: 'button',
              className: 'tc-delete wl-delete',
              'aria-label': t('vocab.delete', { topic: list.topic }),
              onClick: () => {
                options.onDelete(list.id);
                lists = lists.filter((l) => l.id !== list.id);
                renderLists();
              },
            },
            ['×'],
          ),
        ]);
      }),
    );
  };

  const form = h(
    'form',
    {
      className: 'tc-save',
      onSubmit: async (event) => {
        event.preventDefault();
        const topic = input.value.trim().toLowerCase();
        if (lists.some((l) => l.topic === topic)) {
          status.textContent = t('vocab.duplicate', { topic });
          return;
        }
        button.disabled = true;
        status.textContent = t('vocab.downloading', { topic });
        try {
          const result = await fetchTopicWords(input.value, options.dictionary, options.blocklist, options.fetchImpl, lang);
          const list: VocabList = {
            id: `vocab-${Date.now()}`,
            lang,
            topic: result.topic,
            words: result.words,
            enabled: true,
            fetchedAt: new Date().toISOString(),
          };
          options.onAdd(list);
          lists = [...lists, list];
          renderLists();
          input.value = '';
          status.textContent = t('vocab.added', {
            topic: list.topic,
            words: formatNumber(list.words.length),
            fit: formatNumber(options.countFitting(list.words)),
          });
        } catch (error) {
          const reason = error instanceof VocabError ? error.reason : 'failed';
          const key: Record<string, MessageKey> = {
            'invalid-topic': 'vocab.invalidTopic',
            offline: 'vocab.offline',
            empty: 'vocab.empty',
            failed: 'vocab.failed',
          };
          status.textContent = t(key[reason] ?? 'vocab.failed');
        } finally {
          button.disabled = false;
        }
      },
    },
    [input, button],
  );

  const panel = h('div', { className: 'tc-panel sd-panel' }, [
    h('header', {}, [
      h('h2', { id: 'wl-title' }, [t('vocab.title')]),
      h('p', { className: 'tc-intro' }, [t('vocab.intro')]),
      h('p', { className: 'tc-intro wl-privacy' }, [t('vocab.privacy', { site: new URL(VOCAB_API_ORIGINS[lang]).host })]),
    ]),
    h('div', { className: 'sd-row' }, [form, status]),
    h('div', { className: 'sd-row' }, [h('h3', {}, [t('vocab.saved')]), listBox]),
    h('footer', {}, [
      h('div', { className: 'tc-actions' }, [
        h('button', { type: 'button', className: 'tc-secondary', onClick: () => close() }, [t('vocab.close')]),
      ]),
    ]),
  ]);

  const root = h('div', { className: 'dialog word-lists', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wl-title' }, [
    panel,
  ]);

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
  renderLists();
  host.append(root);
  input.focus();
  return { close };
}
