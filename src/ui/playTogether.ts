/**
 * Play together (REQUIREMENTS §13e): host or join a game with players on the
 * same network. There's no server, so players carry a handshake code each
 * way: as a link, pasted, played as sound, or shown as a QR code.
 */
import './dialog.css';
import './playTogether.css';
import { HandshakeError, encodeHandshake, handshakeFromBytes, handshakeToBytes, decodeHandshake, type HandshakeKind } from '../core/net/handshake';
import type { Lobby } from '../core/net/lobby';
import { t, type MessageKey } from '../i18n';
import type { Badge } from '../storage/profiles';
import { BADGES } from '../storage/profiles';
import { takeRelayedAnswers } from '../net/answerRelay';
import { GuestGame, type GuestEnd, type RaceStart } from '../net/guest';
import { HostGame } from '../net/host';
import { PeerError, answerInvite, peersSupported } from '../net/peer';
import { scanCodes, scanSupported } from '../net/scan';
import { listenForCodes, playCode, soundSupported } from '../net/sound';
import { encodeQr, qrSvg } from '../core/qr';
import { badgeSvg, artElement } from './art';
import { h, trapFocus } from './dom';

export interface PlayTogetherOptions {
  me: { name: string; badge: Badge };
  /** e.g. "2.32.0". */
  app: string;
  /** A joiner's name fit to show (cleaned, through the word filter), or a stand-in. */
  nameFor(sent: string, seat: number): string;
  /** The link that carries a code: `#join=` for the host's, `#answer=` for a reply. */
  linkFor(kind: 'join' | 'answer', code: string): string;
  /** Opened from a join link: go straight to joining with this code. */
  joinCode?: string;
  /** A reply link opened in a tab that isn't the hosting one. */
  strayAnswer?: string;
  /** The hosting tab in this browser took that reply, so this tab can be closed. */
  answerRelayed?: boolean;
  /** Back from a race: open on this game's lobby. */
  resume?: { host: HostGame } | { guest: GuestGame };
  /** Back from a race that ended because the connection did. */
  ended?: GuestEnd;
  /** The host pressed Start: the dialog closes and hands over the game. */
  onHostRace(host: HostGame): void;
  /** The host started a race: the dialog closes and hands over the game. */
  onGuestRace(guest: GuestGame, race: RaceStart): void;
  onClose(): void;
}

type View =
  | { v: 'choose' }
  | { v: 'host'; code: string | null }
  | { v: 'joinPaste' }
  | { v: 'joinReply'; code: string }
  | { v: 'joined' }
  | { v: 'ended'; why: GuestEnd }
  | { v: 'stray'; code: string };

const END_MESSAGES: Record<GuestEnd, MessageKey> = {
  hostLeft: 'together.end.hostLeft',
  lost: 'together.end.lost',
  version: 'together.end.version',
  full: 'together.end.full',
};

/** What to tell the player about a failed step. */
function problemMessage(error: unknown, expecting: HandshakeKind): string {
  if (error instanceof HandshakeError) {
    if (error.problem === 'empty') return t('together.error.empty');
    if (error.problem === 'version') return t('together.error.version');
    return t('together.error.damaged');
  }
  if (error instanceof PeerError) {
    if (error.problem === 'wrongKind') return t(expecting === 'answer' ? 'together.error.notReply' : 'together.error.notInvite');
    if (error.problem === 'unsupported') return t('together.unsupported');
  }
  return t('together.error.unreachable');
}

export function openPlayTogether(host: HTMLElement, options: PlayTogetherOptions): { close(): void } {
  const previousFocus = document.activeElement as HTMLElement | null;
  let view: View = options.strayAnswer ? { v: 'stray', code: options.strayAnswer } : { v: 'choose' };
  let hosting: HostGame | null = null;
  let guest: GuestGame | null = null;
  let cancelJoin: (() => void) | null = null;
  let stopRelay: (() => void) | null = null;
  let stopListening: (() => void) | null = null;
  let stopSound: (() => void) | null = null;
  let stopScan: (() => void) | null = null;
  /** Codes show as QR codes too, once asked for (kept as new invites are made). */
  let showQr = false;
  let closed = false;
  /** Closing hands the game to a race instead of ending it. */
  let handingOff = false;
  let lobbySize = 0;

  const body = h('div', { className: 'pt-body' });
  const status = h('p', { className: 'sd-status pt-status', role: 'status', 'aria-live': 'polite' });
  const say = (text: string) => {
    status.textContent = text;
  };

  const stopScanning = () => {
    stopScan?.();
    stopScan = null;
  };

  /** Microphone, speaker and camera off. */
  const stopAudio = () => {
    stopListening?.();
    stopListening = null;
    stopSound?.();
    stopSound = null;
    stopScanning();
  };

  // ---- Pieces ----------------------------------------------------------

  /** A code to send: shown, with ways to send it. */
  const codeBox = (code: string, kind: 'join' | 'answer') => {
    const link = options.linkFor(kind, code);
    const copy = async (text: string, done: MessageKey) => {
      try {
        await navigator.clipboard.writeText(text);
        say(t(done));
      } catch {
        // No clipboard: select the code so it can be copied by hand.
        const range = document.createRange();
        range.selectNodeContents(codeText);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
        say(t('together.copyByHand'));
      }
    };
    const codeText = h('code', { className: 'pt-code', 'aria-label': t('together.codeLabel') }, [code]);
    const soundButton = soundSupported()
      ? h('button', {
          type: 'button',
          className: 'tc-secondary',
          'data-id': 'play-sound',
          onClick: () => {
            stopAudio();
            const playing = playCode(handshakeToBytes(decodeHandshake(code)));
            stopSound = playing.stop;
            soundButton!.disabled = true;
            say(t('together.playing'));
            void playing.done.then(() => {
              soundButton!.disabled = false;
              if (stopSound === playing.stop) stopSound = null;
              say(t('together.played'));
            });
          },
        }, [t('together.playSound')])
      : null;
    // The QR code holds the whole link, so a phone's camera app can open it straight away.
    const qr = h('figure', { className: 'pt-qr', hidden: !showQr }, [
      artElement(qrSvg(encodeQr(link), t('together.qrLabel')), 'pt-qr-code'),
      h('figcaption', { className: 'pt-note' }, [t('together.qrHint')]),
    ]);
    const qrButton = h('button', {
      type: 'button',
      className: 'tc-secondary',
      'data-id': 'show-qr',
      'aria-expanded': String(showQr),
      onClick: () => {
        showQr = !showQr;
        qr.hidden = !showQr;
        qrButton.setAttribute('aria-expanded', String(showQr));
        qrButton.textContent = t(showQr ? 'together.hideQr' : 'together.showQr');
      },
    }, [t(showQr ? 'together.hideQr' : 'together.showQr')]);
    return h('div', { className: 'pt-send' }, [
      codeText,
      h('div', { className: 'tc-actions pt-actions' }, [
        h('button', { type: 'button', className: 'tc-primary', 'data-id': 'copy-link', onClick: () => void copy(link, 'together.copiedLink') }, [
          t('together.copyLink'),
        ]),
        h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'copy-code', onClick: () => void copy(code, 'together.copiedCode') }, [
          t('together.copyCode'),
        ]),
        qrButton,
        soundButton,
      ]),
      qr,
    ]);
  };

  /** A place to paste (or hear) the other player's code. */
  const pasteBox = (expecting: HandshakeKind, label: string, onCode: (code: string) => Promise<void>) => {
    const input = h('input', {
      type: 'text',
      className: 'tc-name pt-paste',
      'data-id': 'paste',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': label,
      placeholder: t('together.pastePlaceholder'),
    });
    const connect = h('button', { type: 'submit', className: 'tc-primary', 'data-id': 'connect' }, [t('together.connect')]);
    const submit = async () => {
      stopAudio();
      connect.disabled = true;
      say(t('together.connecting'));
      try {
        await onCode(input.value);
      } catch (error) {
        say(problemMessage(error, expecting));
      } finally {
        connect.disabled = false;
      }
    };
    const listen = soundSupported()
      ? h('button', {
          type: 'button',
          className: 'tc-secondary',
          'data-id': 'listen',
          'aria-pressed': 'false',
          onClick: async () => {
            if (stopListening) {
              stopAudio();
              listen!.setAttribute('aria-pressed', 'false');
              listen!.textContent = t('together.listen');
              say('');
              return;
            }
            scanOff();
            try {
              const listening = await listenForCodes((bytes) => {
                try {
                  const handshake = handshakeFromBytes(bytes);
                  if (handshake.kind !== expecting) return;
                  input.value = encodeHandshake(handshake);
                  listen!.setAttribute('aria-pressed', 'false');
                  listen!.textContent = t('together.listen');
                  void submit();
                } catch {
                  // A garbled copy: keep listening for the next.
                }
              });
              if (closed) return listening.stop();
              stopListening = listening.stop;
              listen!.setAttribute('aria-pressed', 'true');
              listen!.textContent = t('together.stopListening');
              say(t('together.listening'));
            } catch {
              say(t('together.error.microphone'));
            }
          },
        }, [t('together.listen')])
      : null;
    const video = h('video', { className: 'pt-camera', 'aria-label': t('together.cameraLabel') });
    const camera = h('div', { className: 'pt-scan', hidden: true }, [video]);
    const scanOff = () => {
      stopScanning();
      camera.hidden = true;
      scan?.setAttribute('aria-pressed', 'false');
      if (scan) scan.textContent = t('together.scan');
    };
    let wrongSaid = false;
    const scan = scanSupported()
      ? h('button', {
          type: 'button',
          className: 'tc-secondary',
          'data-id': 'scan',
          'aria-pressed': 'false',
          onClick: async () => {
            if (stopScan) {
              scanOff();
              say('');
              return;
            }
            stopAudio();
            listen?.setAttribute('aria-pressed', 'false');
            if (listen) listen.textContent = t('together.listen');
            camera.hidden = false;
            wrongSaid = false;
            say(t('together.scanning'));
            try {
              const scanning = await scanCodes(video, (text) => {
                try {
                  const handshake = decodeHandshake(text);
                  if (handshake.kind !== expecting) {
                    if (!wrongSaid) say(t(expecting === 'answer' ? 'together.error.notReply' : 'together.error.notInvite'));
                    wrongSaid = true;
                    return;
                  }
                  input.value = encodeHandshake(handshake);
                  scanOff();
                  void submit();
                } catch {
                  // Some other QR code, or a misread: keep looking.
                }
              });
              if (closed || camera.hidden || !camera.isConnected) return scanning.stop();
              stopScan = scanning.stop;
              scan!.setAttribute('aria-pressed', 'true');
              scan!.textContent = t('together.stopScan');
            } catch {
              camera.hidden = true;
              say(t('together.error.camera'));
            }
          },
        }, [t('together.scan')])
      : null;
    const form = h(
      'form',
      {
        className: 'tc-save pt-receive',
        onSubmit: (event) => {
          event.preventDefault();
          void submit();
        },
      },
      [input, connect, scan, listen, camera],
    );
    return { form, input };
  };

  const lobbyList = (lobby: Lobby, you: string) =>
    h(
      'ul',
      { className: 'pt-lobby', 'aria-label': t('together.players') },
      lobby.players.map((p) => {
        const badge = (BADGES as readonly string[]).includes(p.badge) ? (p.badge as Badge) : 'ink';
        const notes = [p.host ? t('together.hostTag') : null, p.id === you ? t('together.youTag') : null].filter(Boolean).join(' · ');
        return h('li', { className: 'pt-player' }, [
          artElement(badgeSvg(badge), 'pt-badge'),
          h('span', { className: 'pt-name' }, [p.name]),
          notes ? h('span', { className: 'pt-note' }, [notes]) : null,
          p.rttMs !== null ? h('span', { className: 'pt-rtt' }, [t('together.rtt', { ms: p.rttMs })]) : null,
        ]);
      }),
    );

  /** Pings and joins only redraw the player list, so a half-pasted code or Listen isn't disturbed. */
  const refreshLobby = (lobby: Lobby, you: string) => {
    body.querySelector('.pt-lobby')?.replaceWith(lobbyList(lobby, you));
  };

  const step = (n: number, text: string) => h('h3', { className: 'pt-step' }, [h('span', { className: 'pt-step-n' }, [String(n)]), text]);

  // ---- Flows -----------------------------------------------------------

  const startHosting = async (game = new HostGame({ me: options.me, app: options.app, nameFor: options.nameFor })) => {
    hosting = game;
    lobbySize = game.lobby.players.length;
    game.onChange((lobby) => {
      if (closed || view.v !== 'host') return;
      // A player joining or leaving changes whether Start is offered; a ping only changes the list.
      if (lobby.players.length !== lobbySize) {
        lobbySize = lobby.players.length;
        render(false);
      } else {
        refreshLobby(lobby, 'host');
      }
    });
    stopRelay = takeRelayedAnswers((code) => void admit(code).catch((error) => say(problemMessage(error, 'answer'))));
    view = { v: 'host', code: null };
    render();
    await newInvite();
  };

  /** Close, keeping the connection open for the race. */
  const handOff = () => {
    handingOff = true;
    close();
  };

  const watchGuest = (game: GuestGame) => {
    guest = game;
    game.onChange((lobby) => {
      if (closed) return;
      if (view.v === 'joined') return refreshLobby(lobby, game.you ?? '');
      view = { v: 'joined' };
      render();
      say(t('together.inLobby'));
    });
    game.onEnd((why) => {
      if (closed) return;
      guest = null;
      view = { v: 'ended', why };
      render();
    });
    game.onRace((race) => {
      if (closed) return;
      handOff();
      options.onGuestRace(game, race);
    });
  };

  const newInvite = async () => {
    if (!hosting || closed) return;
    if (hosting.full) {
      view = { v: 'host', code: null };
      render(false);
      return;
    }
    try {
      const code = await hosting.invite();
      if (closed) return;
      view = { v: 'host', code };
      render(false);
    } catch (error) {
      say(problemMessage(error, 'answer'));
    }
  };

  const admit = async (answer: string) => {
    if (!hosting) return;
    const before = new Set(hosting.lobby.players.map((p) => p.id));
    try {
      await hosting.admit(answer);
    } catch (error) {
      // A connection that failed can't be retried: make a fresh invite.
      if (error instanceof PeerError) await newInvite();
      throw error;
    }
    const joined = hosting.lobby.players.find((p) => !before.has(p.id));
    // The code was used: clear it, so the next player's reply goes into an empty box.
    const paste = body.querySelector<HTMLInputElement>('.pt-paste');
    if (paste) paste.value = '';
    await newInvite();
    say(joined ? t('together.joined', { name: joined.name }) : t('together.refused'));
  };

  const join = async (offer: string) => {
    cancelJoin?.();
    const joining = await answerInvite(offer);
    cancelJoin = joining.cancel;
    view = { v: 'joinReply', code: joining.code };
    render();
    say(t('together.waitingForHost'));
    try {
      const peer = await joining.connected;
      if (closed) return peer.close();
      watchGuest(new GuestGame(peer, options.me, options.app));
    } catch {
      if (closed) return;
      view = { v: 'joinPaste' };
      render();
      say(t('together.error.unreachable'));
    }
  };

  // ---- Screens ---------------------------------------------------------

  const screens: Record<View['v'], () => (HTMLElement | null)[]> = {
    choose: () =>
      peersSupported()
        ? [
            h('p', { className: 'tc-intro' }, [t('together.intro')]),
            h('div', { className: 'pt-choices' }, [
              h('button', { type: 'button', className: 'tc-primary pt-choice', 'data-id': 'host', 'data-autofocus': true, onClick: () => void startHosting() }, [
                h('strong', {}, [t('together.host')]),
                h('span', {}, [t('together.hostDetail')]),
              ]),
              h('button', {
                type: 'button',
                className: 'tc-secondary pt-choice',
                'data-id': 'join',
                onClick: () => {
                  view = { v: 'joinPaste' };
                  render();
                },
              }, [h('strong', {}, [t('together.join')]), h('span', {}, [t('together.joinDetail')])]),
            ]),
            h('p', { className: 'tc-intro pt-privacy' }, [t('together.privacy')]),
          ]
        : [h('p', { className: 'sd-message' }, [t('together.unsupported')])],

    host: () => {
      if (!hosting || view.v !== 'host') return [];
      const code = view.code;
      return [
        lobbyList(hosting.lobby, 'host'),
        hosting.full
          ? h('p', { className: 'sd-message' }, [t('together.full')])
          : code === null
            ? h('p', { className: 'sd-message' }, [t('together.making')])
            : h('div', { className: 'pt-steps' }, [
                step(1, t('together.hostStep1')),
                codeBox(code, 'join'),
                step(2, t('together.hostStep2')),
                pasteBox('answer', t('together.pasteReply'), admit).form,
              ]),
        hosting.lobby.players.length >= 2
          ? h('div', { className: 'pt-start' }, [
              h('p', { className: 'tc-intro' }, [t('together.readyToRace')]),
              h(
                'button',
                {
                  type: 'button',
                  className: 'tc-primary pt-start-btn',
                  'data-id': 'start',
                  onClick: () => {
                    const game = hosting;
                    if (!game) return;
                    handOff();
                    options.onHostRace(game);
                  },
                },
                [t('together.start')],
              ),
            ])
          : h('p', { className: 'tc-intro' }, [t('together.needPlayers')]),
      ];
    },

    joinPaste: () => {
      const { form, input } = pasteBox('offer', t('together.pasteInvite'), join);
      input.dataset.autofocus = '';
      return [step(1, t('together.joinStep1')), form, h('p', { className: 'tc-intro pt-privacy' }, [t('together.privacy')])];
    },

    joinReply: () => (view.v === 'joinReply' ? [step(2, t('together.joinStep2')), codeBox(view.code, 'answer')] : []),

    joined: () => (guest?.lobby && guest.you ? [lobbyList(guest.lobby, guest.you), h('p', { className: 'tc-intro' }, [t('together.waitingToStart')])] : []),

    ended: () => (view.v === 'ended' ? [h('p', { className: 'sd-message' }, [t(END_MESSAGES[view.why])])] : []),

    stray: () =>
      view.v !== 'stray'
        ? []
        : options.answerRelayed
          ? [h('p', { className: 'sd-message' }, [t('together.relayed')])]
          : [h('p', { className: 'tc-intro' }, [t('together.stray')]), codeBox(view.code, 'answer')],
  };

  function render(focus = true) {
    // The camera's video is about to be replaced.
    stopScanning();
    const focused = body.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.id : undefined;
    const typed = body.querySelector<HTMLInputElement>('.pt-paste')?.value ?? '';
    body.replaceChildren(...screens[view.v]().filter((el): el is HTMLElement => el !== null));
    // Keep a half-pasted code across redraws (a player joining, a ping).
    const paste = body.querySelector<HTMLInputElement>('.pt-paste');
    if (paste && !focus) paste.value = typed;
    const restore = focused ? body.querySelector<HTMLElement>(`[data-id="${focused}"]`) : null;
    if (restore) restore.focus({ preventScroll: true });
    else if (focus) (body.querySelector<HTMLElement>('[data-autofocus]') ?? body.querySelector<HTMLElement>('button, input'))?.focus();
  }

  // ---- Dialog ----------------------------------------------------------

  const panel = h('div', { className: 'tc-panel sd-panel pt-panel' }, [
    h('header', {}, [
      h('h2', { id: 'pt-title' }, [t('together.title'), h('span', { className: 'beta-badge' }, [t('together.beta')])]),
      h('p', { className: 'tc-intro pt-beta' }, [t('together.betaNote')]),
    ]),
    body,
    status,
    h('footer', {}, [
      h('div', { className: 'tc-actions' }, [h('button', { type: 'button', className: 'tc-secondary', 'data-id': 'close', onClick: () => close() }, [t('together.close')])]),
    ]),
  ]);
  const root = h('div', { className: 'dialog play-together', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pt-title' }, [panel]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      trapFocus(root, event);
    }
  };

  function close() {
    if (closed) return;
    closed = true;
    stopAudio();
    stopRelay?.();
    if (!handingOff) {
      cancelJoin?.();
      hosting?.close();
      guest?.leave();
    }
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
    previousFocus?.focus?.();
    options.onClose();
  }

  root.addEventListener('keydown', onKeyDown);
  host.append(root);
  render();
  if (options.ended) {
    view = { v: 'ended', why: options.ended };
    render();
  } else if (options.resume && 'host' in options.resume) {
    void startHosting(options.resume.host);
  } else if (options.resume) {
    watchGuest(options.resume.guest);
    view = { v: 'joined' };
    render();
  } else if (options.joinCode) {
    view = { v: 'joinPaste' };
    render();
    const input = body.querySelector<HTMLInputElement>('.pt-paste');
    if (input) input.value = options.joinCode;
    void join(options.joinCode).catch((error) => say(problemMessage(error, 'offer')));
  }
  return { close };
}
