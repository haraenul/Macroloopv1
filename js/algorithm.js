// algorithm.js
//
// Phase 1 scope: static Mifflin-St Jeor target calculation only.
// The adaptive TDEE update (build brief section 4.5 — EWMA smoothing,
// back-calculated TDEE, Learning/Personalized mode) is Phase 3 work and
// will be added to this same file. It reuses SAFETY_FLOOR_KCAL below,
// so keep that export's shape stable when that lands.
//
// Everything here is a pure function: no DOM, no Firebase, no fetch.
// That's deliberate — see algorithm.test.js.

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Build brief 4.1: don't let the calculated target drop below these.
export const SAFETY_FLOOR_KCAL = {
  male: 1500,
  female: 1200,
};

// The brief's own energy-balance conversion factor (used again in 4.5).
const KCAL_PER_KG = 7700;

/**
 * Mifflin-St Jeor BMR.
 * @param {{sex: 'male'|'female', weightKg: number, heightCm: number, age: number}} p
 */
export function calculateBMR({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  if (!multiplier) throw new Error(`Unknown activity level: ${activityLevel}`);
  return bmr * multiplier;
}

/**
 * Applies a goal-based deficit/surplus to TDEE, then clamps to the safety
 * floor. This is the one guarantee in this file that must never fail
 * silently — see the floor tests in algorithm.test.js.
 *
 * @param {{tdee:number, goal:'lose'|'maintain'|'gain', weightKg:number,
 *   sex:'male'|'female', ratePercent?:number}} p  ratePercent is % of
 *   bodyweight per week; brief's sustainable default range is ~0.5-1%.
 * @returns {{target:number, warning:string|null}}
 */
export function calculateTarget({ tdee, goal, weightKg, sex, ratePercent = 0.75 }) {
  if (goal === 'maintain') {
    return { target: Math.round(tdee), warning: null };
  }

  const weeklyChangeKcal = (ratePercent / 100) * weightKg * KCAL_PER_KG;
  const dailyAdjustment = weeklyChangeKcal / 7;
  const raw = goal === 'lose' ? tdee - dailyAdjustment : tdee + dailyAdjustment;

  const floor = SAFETY_FLOOR_KCAL[sex] ?? SAFETY_FLOOR_KCAL.female;
  let target = Math.round(raw);
  let warning = null;

  if (goal === 'lose' && target < floor) {
    target = floor;
    warning =
      'Your selected rate would drop below a safe daily minimum, so your target is capped there. Talk to a doctor or dietitian before going lower.';
  } else if (ratePercent > 1) {
    warning =
      'That rate is faster than the ~0.5–1% of bodyweight/week most guidance treats as sustainable.';
  }

  return { target, warning };
}

/** One-line explanation shown at the end of onboarding (brief section 3, screen 1). */
export function explainTarget({ bmr, tdee, target, goal }) {
  const bmrR = Math.round(bmr);
  const tdeeR = Math.round(tdee);
  if (goal === 'maintain') {
    return `Based on your stats, your body burns about ${tdeeR} kcal/day at rest and activity combined — that's your starting target.`;
  }
  const direction = goal === 'lose' ? 'below' : 'above';
  return `Your estimated maintenance is ${tdeeR} kcal/day (from a ${bmrR} kcal base rate). Your target of ${target} kcal/day is set ${direction} that to match your goal.`;
}

/**
 * Default macro split. The brief specifies calorie targets but not a
 * macro split — this is an assumption, not something from the brief:
 * protein anchored to bodyweight (1.6 g/kg, a common general-purpose
 * default), fat at 25% of calories, carbs filling the remainder.
 * Worth making user-adjustable later; fine as a Phase 1 default.
 */
export function calculateMacroTargets(calorieTarget, weightKg) {
  const proteinG = Math.round(1.6 * weightKg);
  const proteinKcal = proteinG * 4;
  const fatKcal = calorieTarget * 0.25;
  const fatG = Math.round(fatKcal / 9);
  const carbKcal = Math.max(calorieTarget - proteinKcal - fatKcal, 0);
  const carbG = Math.round(carbKcal / 4);
  return { proteinG, fatG, carbG };
}

// ---- Unit conversions (onboarding stores metric internally; brief 4.1) ----

export function lbToKg(lb) {
  return lb * 0.45359237;
}
export function kgToLb(kg) {
  return kg / 0.45359237;
}
export function inToCm(inches) {
  return inches * 2.54;
}
export function cmToIn(cm) {
  return cm / 2.54;
}
export function ftInToCm(feet, inches) {
  return inToCm(feet * 12 + inches);
}
export function cmToFtIn(cm) {
  const totalIn = cmToIn(cm);
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - feet * 12);
  return { feet, inches };
}
