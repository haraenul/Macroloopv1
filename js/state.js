// state.js
// Minimal pub-sub store shared across screens. This is the glue that lets
// firebase.js / food-log.js update state and have index.html's render
// functions react to it, without prop-drilling through multiple files or
// pulling in a framework.

const state = {
  user: null, // Firebase auth user, or null when signed out
  profile: null, // users/{uid}/profile
  today: {
    date: null, // 'YYYY-MM-DD', local date
    foodEntries: {}, // entryId -> entry
  },
};

const listeners = new Map(); // key -> Set<callback>

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
  notify(key);
}

/** Shallow-merges patch into state[key] — for the object-shaped keys (profile, today). */
export function patchState(key, patch) {
  state[key] = { ...state[key], ...patch };
  notify(key);
}

/** Returns an unsubscribe function. */
export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

function notify(key) {
  listeners.get(key)?.forEach((cb) => cb(state[key]));
}

/** Local YYYY-MM-DD — deliberately not UTC, so "today" matches the user's own day. */
export function todayLocalDate() {
  return formatLocalDate(new Date());
}

/** YYYY-MM-DD for N days before today, local time — for trend-window start dates. */
export function daysAgoLocalDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

function formatLocalDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
