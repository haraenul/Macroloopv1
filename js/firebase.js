// firebase.js
// Firebase init + auth + Realtime Database helpers.
//
// CDN modular SDK, v12.15.0 (confirmed current against firebase.google.com
// docs as of this build) — no npm, no bundler, matches the rest of the
// app. If you bump this version later, bump it in every import below
// consistently; mixing SDK versions across imports breaks at runtime.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  query,
  orderByKey,
  startAt,
  endAt,
  limitToLast,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';

// TODO: paste your actual config from the Firebase console
// (Project settings -> General -> Your apps -> SDK setup and configuration).
// This object is not a secret — access control is enforced by the
// security rules in firebase-rules.json, not by hiding this config.
const firebaseConfig = {
  apiKey: 'AIzaSyAj72iSSmvmiKawwD6NPskV957c_Mwyz8Y',
  authDomain: 'macroloop-b2dd5.firebaseapp.com',
  databaseURL: 'https://macroloop-b2dd5-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'macroloop-b2dd5',
  storageBucket: 'macroloop-b2dd5.firebasestorage.app',
  messagingSenderId: '530415918048',
  appId: '1:530415918048:web:3f5dd58d8e59b752a2e985',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// ---- Auth ----
// Email/password only for Phase 1 — an assumption, not specified in the
// brief. Adding Google sign-in later is additive, doesn't touch this shape.

export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  return signOut(auth);
}

/** Fires immediately with the current user (or null), then on every change. */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---- Profile ----

export async function getProfile(uid) {
  const snap = await get(ref(db, `users/${uid}/profile`));
  return snap.exists() ? snap.val() : null;
}

export function saveProfile(uid, profile) {
  return set(ref(db, `users/${uid}/profile`), profile);
}

// ---- Weight log ----
// Weight lives here, not on profile, because it's checked in over time
// (brief section 6) and the Phase 3 adaptive algorithm reads it as a
// trend. The target calculation always needs "current weight" though —
// getLatestWeight() is how Today (and onboarding, after the first entry
// exists) gets it without the caller needing to know the date.

export function saveWeightEntry(uid, date, weightKg) {
  return set(ref(db, `users/${uid}/weight_log/${date}`), { weight_kg: weightKg });
}

export async function getLatestWeight(uid) {
  const q = query(ref(db, `users/${uid}/weight_log`), orderByKey(), limitToLast(1));
  const snap = await get(q);
  if (!snap.exists()) return null;
  const [[, entry]] = Object.entries(snap.val());
  return entry.weight_kg;
}

/** Same range-read pattern as getFoodLogRange — for the Progress weight trend. */
export async function getWeightRange(uid, startDate, endDate) {
  const q = query(ref(db, `users/${uid}/weight_log`), orderByKey(), startAt(startDate), endAt(endDate));
  const snap = await get(q);
  return snap.exists() ? snap.val() : {};
}

// ---- Food log ----

export async function getFoodLogForDate(uid, date) {
  const snap = await get(ref(db, `users/${uid}/food_log/${date}`));
  return snap.exists() ? snap.val() : {};
}

export async function addFoodLogEntry(uid, date, entry) {
  const entryRef = push(ref(db, `users/${uid}/food_log/${date}`));
  await set(entryRef, entry);
  return entryRef.key;
}

export function deleteFoodLogEntry(uid, date, entryId) {
  return set(ref(db, `users/${uid}/food_log/${date}/${entryId}`), null);
}

/**
 * Range read across multiple days in one call — the RTDB equivalent of a
 * Firestore date-range query. Works because dates are stored as ISO
 * strings ("YYYY-MM-DD"), which sort lexicographically the same as
 * chronologically, so orderByKey + startAt/endAt gives the right window.
 */
export async function getFoodLogRange(uid, startDate, endDate) {
  const q = query(ref(db, `users/${uid}/food_log`), orderByKey(), startAt(startDate), endAt(endDate));
  const snap = await get(q);
  return snap.exists() ? snap.val() : {};
}

// ---- Exercise log ----
// Same shape as food_log — brief section 6 already specified this path.

export async function getExerciseLogForDate(uid, date) {
  const snap = await get(ref(db, `users/${uid}/exercise_log/${date}`));
  return snap.exists() ? snap.val() : {};
}

export async function addExerciseLogEntry(uid, date, entry) {
  const entryRef = push(ref(db, `users/${uid}/exercise_log/${date}`));
  await set(entryRef, entry);
  return entryRef.key;
}

export function deleteExerciseLogEntry(uid, date, entryId) {
  return set(ref(db, `users/${uid}/exercise_log/${date}/${entryId}`), null);
}

// ---- Frequent foods — maintained on write, read on every quick-add (brief 4.2) ----

export async function getFrequentFoods(uid) {
  const snap = await get(ref(db, `users/${uid}/frequent_foods`));
  return snap.exists() ? snap.val() : {};
}

export async function touchFrequentFood(uid, foodId, foodData) {
  const foodRef = ref(db, `users/${uid}/frequent_foods/${foodId}`);
  const snap = await get(foodRef);
  const existing = snap.exists() ? snap.val() : null;
  return update(foodRef, {
    ...foodData,
    use_count: (existing?.use_count ?? 0) + 1,
    last_used: new Date().toISOString(),
  });
}

// ---- Algorithm state ----
// Written even in Phase 1 (static target only) so the history exists
// before the Phase 3 adaptive logic needs to read back over it.

export async function getAlgorithmState(uid) {
  const snap = await get(ref(db, `users/${uid}/algorithm_state`));
  return snap.exists() ? snap.val() : null;
}

export function saveAlgorithmState(uid, algoState) {
  return update(ref(db, `users/${uid}/algorithm_state`), algoState);
}

export function recordAlgorithmHistory(uid, date, entry) {
  return set(ref(db, `users/${uid}/algorithm_state/history/${date}`), entry);
}

export async function getAlgorithmHistory(uid) {
  const snap = await get(ref(db, `users/${uid}/algorithm_state/history`));
  return snap.exists() ? snap.val() : {};
}
