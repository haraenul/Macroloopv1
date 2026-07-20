// settings.js
//
// Two genuinely pure, testable pieces live here: assembling the data
// export's structure, and deciding whether the Gap Fixer reminder
// banner should show. The DOM-touching parts (triggering a download,
// reading localStorage) stay as thin glue in index.html, same split as
// charts.js/flex-card.js/motion.js throughout this codebase.

/**
 * Assembles a full account data export — brief section 7 requires this
 * be a REAL export, not a settings toggle that does nothing. Structure
 * is deliberately flat and readable rather than mirroring the RTDB
 * paths exactly, since this is meant to be opened and read by a person,
 * not re-imported anywhere.
 */
export function buildDataExport({ profile, weightLog, foodLog, exerciseLog, algorithmState }) {
  return {
    exported_at: new Date().toISOString(),
    format_version: 1,
    profile: profile ?? null,
    weight_log: weightLog ?? {},
    food_log: foodLog ?? {},
    exercise_log: exerciseLog ?? {},
    algorithm_state: algorithmState ?? null,
  };
}

/**
 * Triggers a browser download of the export as a formatted JSON file.
 * Not unit-tested — needs a DOM (Blob/URL/anchor click), same
 * limitation as exportCanvasAsPng in flex-card.js.
 */
export function downloadDataExport(exportObject, filename = 'macroloop-data-export.json') {
  const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Whether to show the Gap Fixer reminder banner on Today. Pure decision
 * logic: reminderTime and nowHHMM are "HH:MM" strings (zero-padded, so
 * plain string comparison sorts correctly by time of day); dismissedDate
 * and todayDateStr are "YYYY-MM-DD". No reminder set, or it's not time
 * yet, or already dismissed today -> don't show.
 */
export function shouldShowGapFixerNudge({ reminderTime, nowHHMM, todayDateStr, dismissedDate }) {
  if (!reminderTime) return false;
  if (nowHHMM < reminderTime) return false;
  return dismissedDate !== todayDateStr;
}
