// flex-card.js
// Brief 4.7: a shareable weekly summary, rendered client-side via canvas
// (no server rendering — keeps this free to run). "Auto-generate Monday
// morning" is implemented as: whenever the user opens this screen on or
// after Monday and a card for the now-completed week hasn't been shown
// yet, compute it then — true generation with the app closed would need
// push notifications, out of scope here (same reasoning as Gap Fixer's
// deferred auto-trigger).
//
// Stats computation is pure and tested. Canvas drawing isn't — same
// DOM-dependency limitation as charts.js.

/** Local YYYY-MM-DD, matching the format used everywhere else in state.js. */
function formatLocalDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Monday of the most recently COMPLETED Monday-Sunday week relative to
 * referenceDate. "Completed" means fully over — even on the current
 * week's own Sunday, that week doesn't count as completed until the
 * next Monday arrives.
 */
export function getMostRecentCompletedWeekStart(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);
  const daysSinceThisMonday = (d.getDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  const thisMonday = new Date(d);
  thisMonday.setDate(d.getDate() - daysSinceThisMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  return lastMonday;
}

/**
 * Pure stats for one Monday-Sunday week. foodLogRange should already
 * cover at least [weekStart, weekStart+6] in the getFoodLogRange()
 * shape ({date: {entryId: entry}}).
 */
export function computeFlexCardStats({ weekStart, foodLogRange, target }) {
  const weekDates = [];
  const cursor = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    weekDates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const dailyTotals = weekDates.map((date) => ({
    date,
    calories: Object.values(foodLogRange[date] ?? {}).reduce((s, e) => s + (e.calories || 0), 0),
  }));

  const loggedDays = dailyTotals.filter((d) => d.calories > 0);
  const avgCalories = loggedDays.length > 0 ? loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length : 0;

  return {
    weekDates,
    dailyTotals,
    daysLogged: loggedDays.length,
    consistencyScore: loggedDays.length / 7,
    avgCalories: Math.round(avgCalories),
    adherencePct: target > 0 ? Math.round((avgCalories / target) * 100) : 0,
  };
}

/**
 * Current consecutive-days-logged streak, counting back from today (or
 * from yesterday if today has nothing logged yet — an unfinished day
 * shouldn't zero out an otherwise-intact streak before it's even over).
 * foodLogRange needs to cover back at least maxLookbackDays; a streak
 * can run longer than the 7-day window the rest of this file cares about.
 */
export function computeStreak(foodLogRange, todayLocalDateStr, maxLookbackDays = 60) {
  const hasEntries = (dateStr) => Object.keys(foodLogRange[dateStr] ?? {}).length > 0;

  const cursor = new Date(`${todayLocalDateStr}T00:00:00`);
  if (!hasEntries(todayLocalDateStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < maxLookbackDays; i++) {
    const dateStr = formatLocalDate(cursor);
    if (!hasEntries(dateStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Whether the week's average-vs-target reading is goal-aligned. 103% of
 * target isn't inherently good or bad news — it means opposite things
 * for a cut (over target, working against the deficit) vs. a bulk (over
 * target, exactly the point). Returns a boolean the canvas drawing uses
 * to pick a color; the percentage itself stays exactly as neutral a
 * number as before, this only changes how it's presented.
 */
export function isAdherenceGoalAligned(adherencePct, goal) {
  const diff = adherencePct - 100;
  if (Math.abs(diff) <= 5) return true; // close to target reads as on-track regardless of goal
  if (goal === 'lose') return diff < 0; // under target is the intended direction for a cut
  if (goal === 'gain') return diff > 0; // over target is the intended direction for a bulk
  return false; // maintain: only "close to target" (handled above) counts as aligned
}

/**
 * Draws a small rounded rect — canvas has no border-radius primitive,
 * this is the manual equivalent used for the bar chart below.
 */
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the card into an existing <canvas>. Not unit-tested — needs a real 2D rendering context. */
export function drawFlexCard(canvas, { weekLabel, stats, streak, target, goal }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const M = 32; // outer margin, consistent on all sides

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12141a');
  bg.addColorStop(1, '#1b1e27');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ---- Wordmark: the loop glyph drawn for real, not a CSS mask this
  // time — same signature element as the ring, so this card actually
  // reads as MacroLoop's own rather than a generic stats screenshot.
  const markR = 9;
  const markX = M + markR;
  const markY = 44;
  ctx.beginPath();
  ctx.arc(markX, markY, markR, -Math.PI / 2, Math.PI * 1.1);
  ctx.strokeStyle = '#e8a94c';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.fillStyle = '#f0ede6';
  ctx.font = '700 24px "Bricolage Grotesque", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('MacroLoop', markX + markR + 10, markY + 1);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#6b6862';
  ctx.font = '500 14px "IBM Plex Mono", monospace';
  ctx.fillText(weekLabel, M, 80);

  // ---- Hero number ----
  ctx.fillStyle = '#e8a94c';
  ctx.font = '800 76px "Bricolage Grotesque", sans-serif';
  ctx.fillText(`${stats.daysLogged}/7`, M, 190);
  ctx.fillStyle = '#9b9691';
  ctx.font = '400 15px "IBM Plex Sans", sans-serif';
  ctx.fillText('days logged', M, 214);

  // ---- Streak + adherence, side by side instead of stacked lines ----
  const statY = 258;
  ctx.fillStyle = '#f0ede6';
  ctx.font = '700 22px "Bricolage Grotesque", sans-serif';
  ctx.fillText(`${streak}`, M, statY);
  const streakNumWidth = ctx.measureText(`${streak}`).width;
  ctx.fillStyle = '#9b9691';
  ctx.font = '400 14px "IBM Plex Sans", sans-serif';
  ctx.fillText(streak === 1 ? 'day streak' : 'day streak', M + streakNumWidth + 8, statY);

  const aligned = isAdherenceGoalAligned(stats.adherencePct, goal);
  ctx.fillStyle = aligned ? '#7fa88c' : '#9b9691';
  ctx.font = '600 15px "IBM Plex Mono", monospace';
  ctx.fillText(`${stats.adherencePct}% of target`, M, statY + 28);

  // ---- Bar chart — full width, rounded tops, evenly filling the card ----
  const barsTop = 320;
  const barsHeight = 92;
  const chartWidth = W - M * 2;
  const barWidth = 26;
  const gap = (chartWidth - barWidth * 7) / 6;

  stats.dailyTotals.forEach((day, i) => {
    const ratio = target > 0 ? day.calories / target : 0;
    const h = day.calories > 0 ? Math.max(8, barsHeight * Math.min(ratio, 1)) : 4;
    const x = M + i * (barWidth + gap);
    const y = barsTop + barsHeight - h;
    ctx.fillStyle = day.calories > 0 ? '#4fb8ae' : 'rgba(240,237,230,0.10)';
    roundedRect(ctx, x, y, barWidth, h, Math.min(6, h / 2));
    ctx.fill();
  });

  ctx.fillStyle = '#6b6862';
  ctx.font = '500 12px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((label, i) => {
    ctx.fillText(label, M + i * (barWidth + gap) + barWidth / 2, barsTop + barsHeight + 22);
  });
  ctx.textAlign = 'left';

  // ---- Bottom hairline + subtle brand tag, so a cropped share still
  // reads as MacroLoop even if the header gets cut off ----
  ctx.strokeStyle = 'rgba(240,237,230,0.09)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, H - 34);
  ctx.lineTo(W - M, H - 34);
  ctx.stroke();
  ctx.fillStyle = '#6b6862';
  ctx.font = '500 11px "IBM Plex Mono", monospace';
  ctx.fillText('macroloop', M, H - 16);
}

/** Triggers a browser download of the canvas as a PNG. */
export function exportCanvasAsPng(canvas, filename = 'macroloop-flex-card.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
