/**
 * A joiner's reply link (`#answer=…`) opened on the host's device lands in a
 * new tab, but the host's connection lives in the tab that's hosting. This
 * passes the code across with a BroadcastChannel, which only reaches tabs of
 * the same site in the same browser: nothing leaves the device.
 */
const CHANNEL = 'inky-keys-play-together';
const ACK_WAIT_MS = 800;

type RelayMessage = { kind: 'answer'; code: string; id: string } | { kind: 'ack'; id: string };

/** Hands `code` to a hosting tab. Resolves true if one took it. */
export function relayAnswer(code: string): Promise<boolean> {
  if (typeof BroadcastChannel !== 'function') return Promise.resolve(false);
  const channel = new BroadcastChannel(CHANNEL);
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const finish = (taken: boolean) => {
      clearTimeout(timer);
      channel.close();
      resolve(taken);
    };
    const timer = setTimeout(() => finish(false), ACK_WAIT_MS);
    channel.onmessage = (e: MessageEvent<RelayMessage>) => {
      if (e.data?.kind === 'ack' && e.data.id === id) finish(true);
    };
    channel.postMessage({ kind: 'answer', code, id } satisfies RelayMessage);
  });
}

/** While hosting: takes reply codes from links opened in other tabs. Returns a stop function. */
export function takeRelayedAnswers(onAnswer: (code: string) => void): () => void {
  if (typeof BroadcastChannel !== 'function') return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent<RelayMessage>) => {
    if (e.data?.kind !== 'answer' || typeof e.data.code !== 'string') return;
    channel.postMessage({ kind: 'ack', id: e.data.id } satisfies RelayMessage);
    onAnswer(e.data.code);
  };
  return () => channel.close();
}
