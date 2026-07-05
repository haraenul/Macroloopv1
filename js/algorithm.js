// algorithm.js
//
// Static Mifflin-St Jeor target calculation (Phase 1) plus the adaptive
// TDEE update (Phase 3, brief 4.5 — EWMA smoothing, back-calculated
// TDEE, Learning/Personalized mode). Both share SAFETY_FLOOR_KCAL below.
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

// ---- Phase 3: adaptive algorithm (brief 4.5) ----
//
// The population-average formula above has no way to see this specific
// person's real metabolism. This section corrects it using their own
// logged intake and actual weight trend as ground truth.

const EWMA_ALPHA = 0.2;
export const ADAPTIVE_WINDOW_DAYS = 14;
const MIN_LOGGING_CONSISTENCY = 0.7;
const BLEND_WEIGHT_NEW = 0.6; // 60% new empirical estimate, 40% prior
const MAX_CHANGE_FRACTION = 0.1; // cap movement to ±10% of the prior estimate per update

/**
 * Exponentially weighted moving average over a daily series, brief 4.5
 * point 1 — smooths noisy day-to-day weight into a trend line. The first
 * point is unsmoothed (nothing to blend with yet); each later point
 * blends alpha of the raw value with (1-alpha) of the running average.
 * Does not forward-fill gaps between entries — it smooths whatever
 * sequence of weigh-ins it's given, treating each as the next step
 * regardless of the calendar gap between them. Fine for the "reduce
 * noise between real readings" job this does; would need forward-fill
 * added if sparse logging ever makes that lag noticeably wrong.
 * series: [{x, y}], sorted ascending by x. Returns the same shape.
 */
export function computeEWMA(series, alpha = EWMA_ALPHA) {
  if (series.length === 0) return [];
  let prevSmoothed = series[0].y;
  return series.map((point, i) => {
    const smoothed = i === 0 ? point.y : alpha * point.y + (1 - alpha) * prevSmoothed;
    prevSmoothed = smoothed;
    return { x: point.x, y: smoothed };
  });
}

/**
 * Brief 4.5 point 2's back-calculation, pulled out as its own pure
 * function specifically so it can be unit-tested against the brief's
 * worked example directly (avgIntake=2000, deltaWeightKg=-0.7, days=14
 * -> 2385), without also having to fight EWMA's smoothing lag to
 * reverse-engineer an input series that happens to net out to -0.7.
 * deltaWeightKg is signed: negative for loss, positive for gain.
 */
export function backCalculateTDEE(avgIntake, deltaWeightKg, days) {
  return avgIntake - (deltaWeightKg * KCAL_PER_KG) / days;
}

/**
 * The full brief 4.5 pipeline: gate on data sufficiency, smooth the
 * weight trend, back-calculate, blend with the prior estimate, cap the
 * per-update movement, and floor it. Mirrors the brief's reference
 * pseudocode, adapted to this codebase's {x,y} series shape and to a
 * sex-keyed floor instead of a single constant.
 *
 * @param {{weightSeries:{x,y}[], intakeSeries:{x,y}[], currentEstimate:number,
 *   daysOfData:number, sex:'male'|'female'}} p  weightSeries/intakeSeries are
 *   already restricted to the assessment window by the caller. intakeSeries
 *   must have one entry per day in the window (0 for unlogged days) — see
 *   aggregateDailyCalories — since logging consistency is measured from it.
 * @returns {{mode:'learning'|'personalized', estimate:number}}
 */
export function updateAdaptiveTDEE({ weightSeries, intakeSeries, currentEstimate, daysOfData, sex }) {
  const loggedDays = intakeSeries.filter((d) => d.y > 0).length;
  const loggingConsistency = intakeSeries.length > 0 ? loggedDays / intakeSeries.length : 0;

  if (daysOfData < ADAPTIVE_WINDOW_DAYS || loggingConsistency < MIN_LOGGING_CONSISTENCY || weightSeries.length < 2) {
    return { mode: 'learning', estimate: currentEstimate };
  }

  const trend = computeEWMA(weightSeries);
  const deltaWeightKg = trend[trend.length - 1].y - trend[0].y;
  const avgIntake = intakeSeries.reduce((sum, d) => sum + d.y, 0) / intakeSeries.length;
  const empiricalTDEE = backCalculateTDEE(avgIntake, deltaWeightKg, intakeSeries.length);

  const blended = BLEND_WEIGHT_NEW * empiricalTDEE + (1 - BLEND_WEIGHT_NEW) * currentEstimate;
  const capped = Math.min(
    Math.max(blended, currentEstimate * (1 - MAX_CHANGE_FRACTION)),
    currentEstimate * (1 + MAX_CHANGE_FRACTION)
  );

  const floor = SAFETY_FLOOR_KCAL[sex] ?? SAFETY_FLOOR_KCAL.female;
  return { mode: 'personalized', estimate: Math.round(Math.max(capped, floor)) };
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
