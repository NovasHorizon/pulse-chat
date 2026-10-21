import { useState } from 'react';
import { api } from './api.js';
import { Logo } from './ui.jsx';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onAuth(await api(`/auth/${mode}`, { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-full lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-line bg-panel p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo className="text-2xl" />
        <div>
          <h1 className="font-display text-6xl font-bold leading-[1.02] tracking-tight">
            Talk in
            <br />
            <span className="text-brand">real time.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-mute">Channels, live messages, who's online and who's typing. Every message arrives the moment it's sent.</p>
        </div>
        <ChatPreview />
        {/* Soft glow behind the preview */}
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <Logo className="mb-10 text-2xl lg:hidden" />
          <h2 className="font-display text-3xl font-bold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-2 text-sm text-mute">{isRegister ? 'Join the conversation in seconds.' : 'Log in to pick up where you left off.'}</p>

          <div className="mt-8 space-y-3">
            {isRegister && (
              <label className="block">
                <span className="sr-only">Your name</span>
                <input className="field" name="name" placeholder="Your name" autoComplete="name" value={form.name} onChange={update} required />
              </label>
            )}
            <label className="block">
              <span className="sr-only">Email</span>
              <input className="field" type="email" name="email" placeholder="Email" autoComplete="email" value={form.email} onChange={update} required />
            </label>
            <label className="block">
              <span className="sr-only">Password</span>
              <input
                className="field"
                type="password"
                name="password"
                placeholder={isRegister ? 'Password (8+ characters)' : 'Password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={update}
                required
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button className="btn mt-6 w-full" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
          </button>

          <p className="mt-6 text-center text-sm text-mute">
            {isRegister ? 'Already have an account?' : 'New to Pulse?'}{' '}
            <button
              type="button"
              className="font-semibold text-brand hover:underline"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setError('');
              }}
            >
              {isRegister ? 'Log in' : 'Create an account'}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}

// Decorative mini conversation on the desktop welcome panel
function ChatPreview() {
  const lines = [
    { name: 'Meera', color: '#f472b6', text: 'Is the new build live?' },
    { name: 'Ravi', color: '#4cc9f0', text: 'Deployed 2 minutes ago 🚀' },
  ];
  return (
    <div className="relative z-10 max-w-md space-y-3 rounded-2xl border border-line bg-raised/80 p-5 backdrop-blur" aria-hidden="true">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-mute">
        <span className="live-dot h-2 w-2 rounded-full bg-live" /> # general · 12 online
      </p>
      {lines.map((l) => (
        <div key={l.name} className="flex gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: l.color }}>
            {l.name[0]}
          </span>
          <div>
            <p className="text-sm font-semibold">{l.name}</p>
            <p className="text-sm text-mute">{l.text}</p>
          </div>
        </div>
      ))}
      <p className="flex items-center gap-1 pl-11 text-xs text-mute">
        Asha is typing
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot inline-block h-1 w-1 rounded-full bg-mute" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </p>
    </div>
  );
}
