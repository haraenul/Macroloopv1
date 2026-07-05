// charts.js
// Small hand-rolled SVG line chart for the Progress screen's trend
// graphs (weight, daily calories). Kept dependency-free, same reasoning
// as the calorie ring in index.html: for two single-line time series,
// writing this is less code than integrating and skinning a charting
// library for a dark custom theme. If Phase 3 needs richer charts
// (multi-series overlays, zoom/pan), that's the point to reconsider —
// not before.
//
// computeChartPoints is pure (no DOM), so the coordinate math is
// unit-tested in charts.test.js without a browser. renderLineChart does
// the actual drawing and is the only part that touches the DOM.

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
 * Draws the chart into an existing <svg> element. Clears any previous
 * contents first, so this is safe to call again on refresh.
 */
export function renderLineChart(svgEl, points, options = {}) {
  const width = options.width ?? 320;
  const height = options.height ?? 140;
  const color = options.color ?? '#e8a94c';
  const ns = 'http://www.w3.org/2000/svg';

  svgEl.innerHTML = '';
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (points.length === 0) {
    return;
  }

  const { plotted, referencePy } = computeChartPoints(points, {
    width,
    height,
    referenceValue: options.referenceValue ?? null,
  });

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
}
