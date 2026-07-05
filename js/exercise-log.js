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

export const ACTIVITIES = [
  { id: 'walking_moderate', label: 'Walking (moderate pace)', met: 3.5 }, // brief 4.4
  { id: 'walking_brisk', label: 'Walking (brisk pace)', met: 4.3 },
  { id: 'running_8kmh', label: 'Running (~8 km/h / 5 mph)', met: 8.0 }, // brief 4.4
  { id: 'running_10min_mi', label: 'Running (10 min/mile)', met: 9.8 },
  { id: 'running_8min_mi', label: 'Running (8 min/mile)', met: 11.8 },
  { id: 'cycling_moderate', label: 'Cycling (moderate)', met: 6.8 }, // brief 4.4
  { id: 'cycling_vigorous', label: 'Cycling (vigorous)', met: 10.0 },
  { id: 'swimming', label: 'Swimming (moderate)', met: 6.0 }, // brief 4.4
  { id: 'weightlifting', label: 'Weightlifting (general)', met: 5.0 }, // within brief's 3.5-6.0 range
  { id: 'yoga', label: 'Yoga', met: 2.5 }, // brief 4.4
  { id: 'hiit', label: 'HIIT', met: 8.0 }, // brief 4.4
  { id: 'elliptical', label: 'Elliptical', met: 5.0 },
  { id: 'basketball', label: 'Basketball', met: 6.5 },
  { id: 'soccer', label: 'Soccer', met: 7.0 },
  { id: 'rowing', label: 'Rowing (moderate)', met: 7.0 },
  { id: 'stairs', label: 'Stair climbing', met: 8.8 },
  { id: 'dancing', label: 'Dancing', met: 4.8 },
  { id: 'custom', label: 'Other (enter calories manually)', met: null },
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
