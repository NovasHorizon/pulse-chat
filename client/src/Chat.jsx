import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL, getToken } from './api.js';
import { Avatar, Logo, dayOf, timeOf } from './ui.jsx';

const GROUP_GAP = 5 * 60 * 1000; // messages from the same person within 5 min are grouped
const byId = (list) => [...new Map(list.map((m) => [m.id, m])).values()];

export default function Chat({ user, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState([]);
  const [typing, setTyping] = useState({}); // userId -> { name, until }
  const [unread, setUnread] = useState({}); // channelId -> count
  const [connected, setConnected] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const socketRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = activeId;
  const active = channels.find((c) => c.id === activeId);

  useEffect(() => {
    api('/channels')
      .then(({ channels }) => {
        setChannels(channels);
        setActiveId((id) => id ?? channels[0]?.id ?? null);
      })
      .catch((err) => err.status === 401 && onLogout());
  }, [onLogout]);

  // One live connection for the whole session
  useEffect(() => {
    const socket = io(API_URL, { auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (activeRef.current) socket.emit('channel:join', activeRef.current); // rejoin after a reconnect
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => err.message === 'unauthorized' && onLogout());
    socket.on('presence', setOnline);
    socket.on('channel:created', (channel) => setChannels((list) => byId([...list, channel])));
    socket.on('message:new', (message) => {
      if (message.channelId === activeRef.current) {
        setMessages((list) => byId([...list, message]));
        setTyping(({ [message.user.id]: _, ...rest }) => rest);
      } else {
        setUnread((u) => ({ ...u, [message.channelId]: (u[message.channelId] || 0) + 1 }));
      }
    });
    socket.on('typing', ({ channelId, user: who }) => {
      if (channelId === activeRef.current) setTyping((t) => ({ ...t, [who.id]: { name: who.name, until: Date.now() + 3000 } }));
    });

    return () => socket.disconnect();
  }, [onLogout]);

  // Typing indicators fade out 3 s after the last keystroke
  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((t) => {
        const live = Object.entries(t).filter(([, v]) => v.until > Date.now());
        return live.length === Object.keys(t).length ? t : Object.fromEntries(live);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Switching channel: join its room and load recent history
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    socketRef.current?.emit('channel:join', activeId);
    setMessages([]);
    setTyping({});
    setLoading(true);
    setUnread((u) => ({ ...u, [activeId]: 0 }));
    api(`/channels/${activeId}/messages`)
      .then(({ messages: history, hasMore }) => {
        if (cancelled) return;
        setMessages((live) => byId([...history, ...live])); // keep anything that arrived while loading
        setHasMore(hasMore);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  async function loadOlder() {
    const { messages: older, hasMore } = await api(`/channels/${activeId}/messages?before=${encodeURIComponent(messages[0].createdAt)}`);
    setMessages((list) => byId([...older, ...list]));
    setHasMore(hasMore);
  }

  const send = (text) =>
    socketRef.current
      .timeout(8000)
      .emitWithAck('message:send', { channelId: activeId, text })
      .catch(() => ({ error: 'Not sent. Check your connection and try again.' }));

  const typingNames = Object.values(typing).map((t) => t.name);

  return (
    <div className="flex h-full">
      {/* Sidebar: always visible on desktop, a slide-in drawer on phones */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity md:hidden ${drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-panel transition-transform md:static md:translate-x-0 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Channels and people"
      >
        <Sidebar
          user={user}
          channels={channels}
          activeId={activeId}
          unread={unread}
          online={online}
          connected={connected}
          onSelect={(id) => {
            setActiveId(id);
            setDrawerOpen(false);
          }}
          onLogout={onLogout}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
          <button className="-ml-1 rounded-lg p-2 text-mute hover:bg-raised md:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open channels">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold"># {active?.name ?? '…'}</h1>
            {active?.description && <p className="truncate text-xs text-mute">{active.description}</p>}
          </div>
          <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-mute">
            <span className={`h-2 w-2 rounded-full ${connected ? 'live-dot bg-live' : 'bg-amber-400'}`} />
            {connected ? `${online.length} online` : 'Reconnecting…'}
          </span>
        </header>

        <MessageList messages={messages} loading={loading} hasMore={hasMore} onLoadOlder={loadOlder} channel={active} me={user} />

        <div className="h-6 px-4 text-xs text-mute md:px-6" aria-live="polite">
          {typingNames.length > 0 && (
            <span className="flex items-center gap-1">
              {typingNames.length === 1 ? `${typingNames[0]} is typing` : typingNames.length === 2 ? `${typingNames.join(' and ')} are typing` : 'Several people are typing'}
              {[0, 1, 2].map((i) => (
                <span key={i} className="typing-dot inline-block h-1 w-1 rounded-full bg-mute" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          )}
        </div>

        {active && <Composer key={active.id} channel={active} onSend={send} onTyping={() => socketRef.current?.emit('typing', active.id)} />}
      </main>
    </div>
  );
}

function Sidebar({ user, channels, activeId, unread, online, connected, onSelect, onLogout }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function create(e) {
    e.preventDefault();
    try {
      const { channel } = await api('/channels', { method: 'POST', body: { name } });
      setName('');
      setCreating(false);
      setError('');
      onSelect(channel.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4">
        <Logo className="text-xl" />
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-live' : 'bg-amber-400'}`} title={connected ? 'Connected' : 'Reconnecting'} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex items-center justify-between px-2 pb-2 pt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-mute">Channels</p>
          <button className="rounded-md px-2 text-lg leading-none text-mute hover:bg-raised hover:text-text" onClick={() => setCreating(!creating)} aria-label="New channel">
            +
          </button>
        </div>

        {creating && (
          <form onSubmit={create} className="mb-2 px-1">
            <input className="field py-2" autoFocus placeholder="new-channel" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
            {error && <p className="mt-1 px-1 text-xs text-red-300">{error}</p>}
          </form>
        )}

        <ul className="space-y-0.5">
          {channels.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                aria-current={c.id === activeId ? 'page' : undefined}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${c.id === activeId ? 'bg-brand-soft font-semibold text-white' : 'text-mute hover:bg-raised hover:text-text'}`}
              >
                <span className="truncate"># {c.name}</span>
                {unread[c.id] > 0 && <span className="rounded-full bg-brand px-2 text-xs font-bold text-white">{unread[c.id]}</span>}
              </button>
            </li>
          ))}
        </ul>

        <p className="px-2 pb-2 pt-6 text-xs font-semibold uppercase tracking-widest text-mute">Online · {online.length}</p>
        <ul className="space-y-1">
          {online.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-2 py-1 text-sm">
              <Avatar user={p} size="h-7 w-7 text-xs" online />
              <span className="truncate">
                {p.name}
                {p.id === user.id && <span className="text-mute"> (you)</span>}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <Avatar user={user} />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{user.name}</p>
        <button className="rounded-lg px-2 py-1 text-xs text-mute hover:bg-raised hover:text-text" onClick={onLogout}>
          Log out
        </button>
      </div>
    </>
  );
}

function MessageList({ messages, loading, hasMore, onLoadOlder, channel, me }) {
  const scroller = useRef(null);
  const stickToBottom = useRef(true);
  const heightBeforeOlder = useRef(null);

  // New messages keep you at the bottom unless you've scrolled up to read;
  // loading older ones keeps your place
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (heightBeforeOlder.current != null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    stickToBottom.current = true;
  }, [channel?.id]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const older = () => {
    heightBeforeOlder.current = scroller.current.scrollHeight;
    onLoadOlder();
  };

  return (
    <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 pt-4 md:px-6" role="log" aria-live="polite" aria-label="Messages">
      {loading && messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-mute">Loading messages…</p>
      ) : (
        <>
          {hasMore ? (
            <button className="mx-auto mb-4 block rounded-full border border-line px-4 py-1.5 text-xs text-mute hover:text-text" onClick={older}>
              Load earlier messages
            </button>
          ) : (
            channel && (
              <div className="mb-6 mt-8">
                <p className="font-display text-3xl font-bold">Welcome to #{channel.name}</p>
                <p className="mt-1 text-sm text-mute">This is the very beginning of the channel.{channel.description && ` ${channel.description}.`}</p>
              </div>
            )
          )}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
            const grouped = prev && !newDay && prev.user.id === m.user.id && new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_GAP;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3 text-xs font-semibold text-mute">
                    <span className="h-px flex-1 bg-line" />
                    {dayOf(m.createdAt)}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <article className={`group flex gap-3 rounded-lg px-2 py-0.5 hover:bg-white/[0.02] ${grouped ? '' : 'mt-3'}`}>
                  {grouped ? (
                    <span className="w-9 shrink-0 pt-0.5 text-right text-[10px] text-transparent group-hover:text-mute">{timeOf(m.createdAt)}</span>
                  ) : (
                    <Avatar user={m.user} />
                  )}
                  <div className="min-w-0">
                    {!grouped && (
                      <p className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold">{m.user.id === me.id ? 'You' : m.user.name}</span>
                        <time className="text-xs text-mute" dateTime={m.createdAt}>
                          {timeOf(m.createdAt)}
                        </time>
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-text/90">{m.text}</p>
                  </div>
                </article>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Composer({ channel, onSend, onTyping }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const lastTyping = useRef(0);

  function change(e) {
    setText(e.target.value);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      onTyping();
    }
  }

  async function submit(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText(''); // feels instant; restored below if sending fails
    setError('');
    const result = await onSend(body);
    if (result.error) {
      setError(result.error);
      setText(body);
    }
  }

  return (
    <form onSubmit={submit} className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-raised p-2 focus-within:border-brand">
        <label className="flex-1">
          <span className="sr-only">Message #{channel.name}</span>
          <textarea
            rows={1}
            value={text}
            onChange={change}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e);
            }}
            placeholder={`Message #${channel.name}`}
            maxLength={1000}
            className="max-h-40 w-full resize-none bg-transparent px-2 py-2 text-[15px] placeholder:text-mute focus:outline-none [field-sizing:content]"
          />
        </label>
        <button className="btn h-10 w-10 shrink-0 p-0" disabled={!text.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 hidden text-[11px] text-mute md:block">Enter to send · Shift + Enter for a new line</p>
    </form>
  );
}
