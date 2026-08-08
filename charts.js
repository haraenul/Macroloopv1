// charts.js
// Small hand-rolled SVG line chart for the Progress screen's trend
// graphs (weight, daily calories). Kept dependency-free of any charting
// library, same reasoning as the calorie ring in index.html — the only
// first-party dependency is motion.js, reused for the reduced-motion
// check so that preference lives in exactly one place.
//
// computeChartPoints, computeAreaPath, findNearestPlottedIndex and
// formatShortDateLabel are pure (no DOM), so the geometry and scrub
// math are unit-tested in charts.test.js without a browser.
// renderLineChart does the actual drawing plus the touch-scrub
// interaction and is the only part that touches the DOM.
import { prefersReducedMotion } from './motion.js';

/**
 * Maps a data series to SVG pixel coordinates on a single consistent
 * scale — including the optional reference line in the min/max, so a
 * target line drawn outside the data's own range doesn't get clipped or
 * end up on a different scale than the plotted points.
 *
 * points: [{x, y}] — x is any label (rendered evenly spaced by index),
 * y is numeric.
 */
export function computeChartPoints(points, { width, height, padding = 24, referenceValue = null }) {
  if (points.length === 0) {
    return { plotted: [], referencePy: null, minY: 0, maxY: 0 };
  }

  const ys = points.map((p) => p.y);
  if (referenceValue != null) ys.push(referenceValue);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1; // avoid divide-by-zero on flat data

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const toY = (y) => padding + innerHeight - ((y - minY) / range) * innerHeight;

  const plotted = points.map((p, i) => ({
    ...p,
    px: points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * innerWidth,
    py: toY(p.y),
  }));

  return {
    plotted,
    referencePy: referenceValue != null ? toY(referenceValue) : null,
    minY,
    maxY,
  };
}

/**
 * Builds the SVG path `d` for the soft fill under the line: the line
 * itself, then straight down to the baseline and back along the bottom,
 * closed. Pure string-building on top of already-plotted points, so the
 * fill shares the exact same scale as the line and dots — no separate
 * geometry to drift out of sync with them.
 */
export function computeAreaPath(plotted, baselineY) {
  if (plotted.length === 0) return '';
  if (plotted.length === 1) {
    // A single point has no line to run under; draw a hairline sliver
    // at that point's x so the gradient still has *something* to fill
    // rather than a degenerate zero-width path.
    const p = plotted[0];
    return `M ${p.px.toFixed(1)} ${p.py.toFixed(1)} L ${p.px.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  }
  const line = plotted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ');
  const last = plotted[plotted.length - 1];
  const first = plotted[0];
  return `${line} L ${last.px.toFixed(1)} ${baselineY.toFixed(1)} L ${first.px.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

/**
 * Given already-plotted points and a pointer position in the same SVG
 * coordinate space, finds the index of the nearest one by x. Pure, so
 * "which day is my finger closest to" is unit-tested without needing to
 * simulate real pointer events.
 */
export function findNearestPlottedIndex(plotted, targetPx) {
  if (plotted.length === 0) return -1;
  let nearestIndex = 0;
  let nearestDist = Math.abs(plotted[0].px - targetPx);
  for (let i = 1; i < plotted.length; i++) {
    const dist = Math.abs(plotted[i].px - targetPx);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIndex = i;
    }
  }
  return nearestIndex;
}

/**
 * Formats a "YYYY-MM-DD" local-date string (the shape every series in
 * this app already uses) as a short "M/D" label for the scrub tooltip.
 * Deliberately string-slicing rather than `new Date(x)` — parsing an
 * ISO date string that way reads it as UTC midnight, which can print as
 * the wrong day once formatted back in a timezone ahead of UTC. Falls
 * back to the raw label for anything that isn't that shape, so a chart
 * fed non-date x-values (a future series) still shows something.
 */
export function formatShortDateLabel(isoDate) {
  const parts = String(isoDate).split('-');
  if (parts.length !== 3 || parts.some((p) => p === '' || Number.isNaN(Number(p)))) {
    return String(isoDate);
  }
  const [, m, d] = parts;
  return `${Number(m)}/${Number(d)}`;
}

/**
 * Draws the chart into an existing <svg> element. Clears any previous
 * contents first, so this is safe to call again on refresh.
 *
 * options.valueFormatter(y) formats the scrub tooltip's number (default:
 * rounds to a whole number — pass e.g. `(v) => v.toFixed(1)` for weight).
 * options.interactive: false disables the touch-scrub layer entirely.
 */
export function renderLineChart(svgEl, points, options = {}) {
  const width = options.width ?? 320;
  const height = options.height ?? 140;
  const padding = options.padding ?? 24;
  const color = options.color ?? 'var(--accent-energy)';
  const valueFormatter = options.valueFormatter ?? ((v) => String(Math.round(v)));
  const ns = 'http://www.w3.org/2000/svg';

  // A previous render may have left scrub listeners attached directly to
  // svgEl — innerHTML='' below clears its children, not listeners bound
  // to svgEl itself, so without this a screen that reloads its chart
  // data would silently stack a new listener on every reload.
  if (svgEl._chartScrubCleanup) {
    svgEl._chartScrubCleanup();
    svgEl._chartScrubCleanup = null;
  }

  svgEl.innerHTML = '';
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (points.length === 0) {
    return;
  }

  const { plotted, referencePy } = computeChartPoints(points, {
    width,
    height,
    padding,
    referenceValue: options.referenceValue ?? null,
  });

  const reduceMotion = prefersReducedMotion();

  // Gradient fill, in the chart's own color, so weight and calories each
  // keep their own established accent rather than sharing one default —
  // a plain area convention (Health-app style), not a decorative glow.
  const defs = document.createElementNS(ns, 'defs');
  const gradientId = `chart-fill-${Math.random().toString(36).slice(2, 9)}`;
  const gradient = document.createElementNS(ns, 'linearGradient');
  gradient.setAttribute('id', gradientId);
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y2', '1');
  const stopTop = document.createElementNS(ns, 'stop');
  stopTop.setAttribute('offset', '0%');
  stopTop.setAttribute('stop-color', color);
  stopTop.setAttribute('stop-opacity', '0.24');
  const stopBottom = document.createElementNS(ns, 'stop');
  stopBottom.setAttribute('offset', '100%');
  stopBottom.setAttribute('stop-color', color);
  stopBottom.setAttribute('stop-opacity', '0');
  gradient.appendChild(stopTop);
  gradient.appendChild(stopBottom);
  defs.appendChild(gradient);
  svgEl.appendChild(defs);

  if (referencePy != null) {
    const refLine = document.createElementNS(ns, 'line');
    refLine.setAttribute('x1', 24);
    refLine.setAttribute('x2', width - 24);
    refLine.setAttribute('y1', referencePy);
    refLine.setAttribute('y2', referencePy);
    refLine.setAttribute('stroke', 'rgba(240,237,230,0.25)');
    refLine.setAttribute('stroke-dasharray', '4 4');
    svgEl.appendChild(refLine);
  }

  const baselineY = height - padding;
  const areaPath = document.createElementNS(ns, 'path');
  areaPath.setAttribute('d', computeAreaPath(plotted, baselineY));
  areaPath.setAttribute('fill', `url(#${gradientId})`);
  areaPath.setAttribute('stroke', 'none');
  svgEl.appendChild(areaPath);

  const d = plotted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  svgEl.appendChild(path);

  plotted.forEach((p) => {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', p.px);
    dot.setAttribute('cy', p.py);
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', color);
    svgEl.appendChild(dot);
  });

  // Draw-in: the line reveals along its own length rather than just
  // appearing, using the classic stroke-dasharray trick. Skipped under
  // reduced motion, where both the line and fill should simply be there.
  if (!reduceMotion && plotted.length > 1) {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    areaPath.style.opacity = '0';
    // Force a style flush so the browser registers the 0% state above
    // before the transition below starts — the same reflow-then-animate
    // pattern motion.js uses for its sheet transitions.
    // eslint-disable-next-line no-unused-expressions
    path.getBoundingClientRect();
    path.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)';
    areaPath.style.transition = 'opacity 0.7s ease 0.25s';
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = '0';
      areaPath.style.opacity = '1';
    });
  }

  if (options.interactive !== false && plotted.length > 0) {
    svgEl._chartScrubCleanup = setupChartScrub(svgEl, plotted, {
      width, height, padding, color, ns, valueFormatter,
    });
  }
}

/**
 * Wires up touch/mouse drag-to-scrub: a transparent hit-area over the
 * whole chart tracks the nearest data point to the pointer and shows its
 * exact value in a small floating chip, the same convention as Health
 * and Whoop-style trend graphs. Returns a cleanup function that removes
 * every listener it added, so a re-render can safely start fresh.
 */
function setupChartScrub(svgEl, plotted, { width, height, padding, color, ns, valueFormatter }) {
  const guide = document.createElementNS(ns, 'line');
  guide.setAttribute('y1', padding * 0.25);
  guide.setAttribute('y2', height - padding * 0.25);
  guide.setAttribute('stroke', 'rgba(243,233,230,0.2)');
  guide.setAttribute('stroke-width', '1');
  guide.style.opacity = '0';
  svgEl.appendChild(guide);

  const dot = document.createElementNS(ns, 'circle');
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', color);
  dot.setAttribute('stroke', 'var(--bg)');
  dot.setAttribute('stroke-width', '2');
  dot.style.opacity = '0';
  svgEl.appendChild(dot);

  const chipGroup = document.createElementNS(ns, 'g');
  chipGroup.style.opacity = '0';
  const chipBg = document.createElementNS(ns, 'rect');
  chipBg.setAttribute('rx', '7');
  chipBg.setAttribute('ry', '7');
  chipBg.setAttribute('height', '22');
  chipBg.setAttribute('fill', 'var(--surface-raised)');
  const chipText = document.createElementNS(ns, 'text');
  chipText.setAttribute('fill', 'var(--text-primary)');
  chipText.setAttribute('font-size', '11');
  chipText.setAttribute('font-family', '"Space Mono", monospace');
  chipText.setAttribute('font-weight', '700');
  chipText.setAttribute('y', '15');
  chipGroup.appendChild(chipBg);
  chipGroup.appendChild(chipText);
  svgEl.appendChild(chipGroup);

  const hitArea = document.createElementNS(ns, 'rect');
  hitArea.setAttribute('x', '0');
  hitArea.setAttribute('y', '0');
  hitArea.setAttribute('width', width);
  hitArea.setAttribute('height', height);
  hitArea.setAttribute('fill', 'transparent');
  hitArea.style.touchAction = 'pan-y';
  hitArea.style.cursor = 'crosshair';
  svgEl.appendChild(hitArea);

  function positionChip(px, py, label) {
    chipText.textContent = label;
    const textWidth = chipText.getComputedTextLength ? chipText.getComputedTextLength() : label.length * 6.5;
    const chipWidth = textWidth + 16;
    const chipX = Math.min(Math.max(px - chipWidth / 2, 2), width - chipWidth - 2);
    const chipY = Math.max(py - 34, 2);
    chipBg.setAttribute('x', chipX);
    chipBg.setAttribute('y', chipY);
    chipBg.setAttribute('width', chipWidth);
    chipText.setAttribute('x', chipX + 8);
    chipText.setAttribute('y', chipY + 15);
  }

  function showAt(clientX) {
    const rect = svgEl.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * width;
    const index = findNearestPlottedIndex(plotted, svgX);
    if (index === -1) return;
    const p = plotted[index];

    guide.setAttribute('x1', p.px);
    guide.setAttribute('x2', p.px);
    dot.setAttribute('cx', p.px);
    dot.setAttribute('cy', p.py);
    positionChip(p.px, p.py, `${formatShortDateLabel(p.x)} · ${valueFormatter(p.y)}`);

    guide.style.opacity = '1';
    dot.style.opacity = '1';
    chipGroup.style.opacity = '1';
  }

  function hide() {
    guide.style.opacity = '0';
    dot.style.opacity = '0';
    chipGroup.style.opacity = '0';
  }

  function onPointerDown(e) {
    hitArea.setPointerCapture?.(e.pointerId);
    showAt(e.clientX);
  }
  function onPointerMove(e) {
    if (e.buttons === 0 && e.pointerType !== 'touch') return;
    showAt(e.clientX);
  }

  hitArea.addEventListener('pointerdown', onPointerDown);
  hitArea.addEventListener('pointermove', onPointerMove);
  hitArea.addEventListener('pointerup', hide);
  hitArea.addEventListener('pointercancel', hide);
  hitArea.addEventListener('pointerleave', hide);

  return () => {
    hitArea.removeEventListener('pointerdown', onPointerDown);
    hitArea.removeEventListener('pointermove', onPointerMove);
    hitArea.removeEventListener('pointerup', hide);
    hitArea.removeEventListener('pointercancel', hide);
    hitArea.removeEventListener('pointerleave', hide);
  };
}
