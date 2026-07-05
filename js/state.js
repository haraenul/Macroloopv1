// state.js
const state = {
  user: null,
  profile: null,
  today: { date: null, foodEntries: {} },
};

const listeners = new Map();

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
  notify(key);
}

export function patchState(key, patch) {
  state[key] = { ...state[key], ...patch };
  notify(key);
}

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

function notify(key) {
  listeners.get(key)?.forEach((cb) => cb(state[key]));
}

export function todayLocalDate() {
  return formatLocalDate(new Date());
}

export function daysAgoLocalDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

function formatLocalDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
