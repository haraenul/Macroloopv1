// exercise-log.js
// MET-based exercise calorie calculation and logging.
//
// MET values for the activities in brief 4.4's own table are taken
// exactly from it (walking, running-8km/h, cycling, swimming,
// weightlifting, HIIT, yoga). The brief invites expanding the list, so
// several more common activities are added at standard Compendium of
// Physical Activities values alongside those. calculateCaloriesBurned
// is a pure function on purpose, same reasoning as algorithm.js — see
// exercise-log.test.js.
//
// Display labels live in strings.js, keyed by the same id (activity_<id>)
// — this file holds ids and MET numbers only, no display text.

export const ACTIVITIES = [
  { id: 'walking_moderate', met: 3.5 }, // brief 4.4
  { id: 'walking_brisk', met: 4.3 },
  { id: 'running_8kmh', met: 8.0 }, // brief 4.4
  { id: 'running_10min_mi', met: 9.8 },
  { id: 'running_8min_mi', met: 11.8 },
  { id: 'cycling_moderate', met: 6.8 }, // brief 4.4
  { id: 'cycling_vigorous', met: 10.0 },
  { id: 'swimming', met: 6.0 }, // brief 4.4
  { id: 'weightlifting', met: 5.0 }, // within brief's 3.5-6.0 range
  { id: 'yoga', met: 2.5 }, // brief 4.4
  { id: 'hiit', met: 8.0 }, // brief 4.4
  { id: 'elliptical', met: 5.0 },
  { id: 'basketball', met: 6.5 },
  { id: 'soccer', met: 7.0 },
  { id: 'rowing', met: 7.0 },
  { id: 'stairs', met: 8.8 },
  { id: 'dancing', met: 4.8 },
  { id: 'custom', met: null },
];

/**
 * Standard compendium formula: kcal = MET x weight(kg) x duration(hours).
 * Returns 0 (not NaN) for invalid inputs so a half-filled form never
 * shows a broken number.
 */
export function calculateCaloriesBurned(met, weightKg, durationMin) {
  if (!met || !weightKg || !durationMin || met <= 0 || weightKg <= 0 || durationMin <= 0) return 0;
  return Math.round(met * weightKg * (durationMin / 60));
}

export async function logExercise(uid, date, { activityLabel, durationMin, caloriesBurned }) {
  const { addExerciseLogEntry } = await import('./firebase.js');
  const entry = {
    activity: activityLabel,
    duration_min: durationMin,
    calories_burned: caloriesBurned,
    timestamp: new Date().toISOString(),
  };
  return addExerciseLogEntry(uid, date, entry);
}
