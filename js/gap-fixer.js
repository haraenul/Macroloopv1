// gap-fixer.js
// Brief 4.6: rule-based, no LLM — a small curated combo list filtered to
// what still fits today's budget, ranked toward whichever macro is the
// biggest relative gap. On-demand only in this build; the "user-set
// auto-fire time" part of the brief needs Settings to exist first (there's
// nowhere to configure a time yet), and true firing while the app isn't
// open needs push notifications — a separate, larger undertaking neither
// asked for here nor implied by "Gap Fixer" alone. See the delivery notes.
//
// Combo nutrition numbers are deliberately rough, representative
// estimates for common choices — not a nutrition database lookup. Good
// enough for "here's a realistic thing you could eat", not meant to be
// logged as-is without a glance, which is why logging one still goes
// through the same manual-entry path as anything else.

export const COMBO_LIBRARY = [
  { id: 'greek_yogurt_berries', calories: 180, protein_g: 20, carbs_g: 18, fat_g: 2 },
  { id: 'chicken_rice_bowl', calories: 420, protein_g: 40, carbs_g: 45, fat_g: 8 },
  { id: 'protein_shake', calories: 150, protein_g: 25, carbs_g: 5, fat_g: 2 },
  { id: 'eggs_toast', calories: 300, protein_g: 18, carbs_g: 28, fat_g: 14 },
  { id: 'cottage_cheese', calories: 160, protein_g: 24, carbs_g: 8, fat_g: 4 },
  { id: 'tuna_crackers', calories: 250, protein_g: 26, carbs_g: 20, fat_g: 6 },
  { id: 'banana_peanut_butter', calories: 270, protein_g: 8, carbs_g: 30, fat_g: 14 },
  { id: 'hummus_veggies', calories: 200, protein_g: 7, carbs_g: 22, fat_g: 10 },
  { id: 'oatmeal_fruit', calories: 250, protein_g: 8, carbs_g: 45, fat_g: 4 },
  { id: 'nuts_mix', calories: 200, protein_g: 6, carbs_g: 8, fat_g: 17 },
  { id: 'turkey_wrap', calories: 320, protein_g: 25, carbs_g: 30, fat_g: 10 },
  { id: 'avocado_toast', calories: 280, protein_g: 6, carbs_g: 30, fat_g: 16 },
  { id: 'salmon_veggies', calories: 380, protein_g: 34, carbs_g: 12, fat_g: 22 },
  { id: 'rice_cakes_pb', calories: 220, protein_g: 7, carbs_g: 24, fat_g: 11 },
  { id: 'edamame', calories: 190, protein_g: 17, carbs_g: 14, fat_g: 8 },
];

/**
 * Picks up to `count` combos that fit the remaining calorie budget,
 * ranked toward whichever macro has the largest *relative* shortfall —
 * remaining-as-a-fraction-of-target, not the raw gram gap, since
 * protein/carb/fat targets sit on very different scales and a raw-gram
 * comparison would just always favor carbs.
 *
 * Returns { combos, priorityMacro } — priorityMacro is 'protein_g' |
 * 'carbs_g' | 'fat_g', useful for the "leaning toward X" caption.
 */
export function pickGapFixerCombos({
  remainingCalories,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  targetProtein,
  targetCarbs,
  targetFat,
  count = 3,
}) {
  if (remainingCalories <= 0) return { combos: [], priorityMacro: null };

  const gapRatios = {
    protein_g: targetProtein > 0 ? remainingProtein / targetProtein : 0,
    carbs_g: targetCarbs > 0 ? remainingCarbs / targetCarbs : 0,
    fat_g: targetFat > 0 ? remainingFat / targetFat : 0,
  };
  const priorityMacro = Object.entries(gapRatios).sort((a, b) => b[1] - a[1])[0][0];

  const fitting = COMBO_LIBRARY.filter((combo) => combo.calories <= remainingCalories);
  const ranked = [...fitting].sort((a, b) => b[priorityMacro] - a[priorityMacro]);

  return { combos: ranked.slice(0, count), priorityMacro };
}
