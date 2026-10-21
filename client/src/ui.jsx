export function Logo({ className = '' }) {
  return (
    <span className={`flex items-center gap-2 font-display font-bold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-[1.2em] w-[1.2em]" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#7c5cff" />
        <path d="M5 17h6l3-8 4 15 3-7h6" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Pulse
    </span>
  );
}

// Same user always gets the same colour
const COLORS = ['#7c5cff', '#ff6b6b', '#3ddc97', '#ffb547', '#4cc9f0', '#f472b6', '#a3e635', '#fb923c'];
export function colorFor(id = '') {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ user, size = 'h-9 w-9 text-sm', online }) {
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={`relative inline-grid shrink-0 place-items-center rounded-xl font-semibold text-white ${size}`} style={{ background: colorFor(user.id) }} aria-hidden="true">
      {initials}
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel bg-live" />}
    </span>
  );
}

export const timeOf = (date) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function dayOf(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}
