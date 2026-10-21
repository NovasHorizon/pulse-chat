import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Auth from './Auth.jsx';
import Chat from './Chat.jsx';
import { Logo } from './ui.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  // Restore the session from a saved token
  useEffect(() => {
    if (!getToken()) return;
    api('/me')
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  const login = ({ token, user }) => {
    setToken(token);
    setUser(user);
  };
  // Stable identity: Chat reconnects its socket if this function changes
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  if (checking) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <Logo className="justify-center text-2xl" />
          <p className="mt-3 text-sm text-mute">Connecting… the free server can take up to a minute to wake up.</p>
        </div>
      </div>
    );
  }

  return user ? <Chat user={user} onLogout={logout} /> : <Auth onAuth={login} />;
}
