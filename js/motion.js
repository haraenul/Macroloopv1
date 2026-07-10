// motion.js
//
// Two things: spring-driven number/value animation (so the ring's kcal
// count, macro grams, and the onboarding reveal count rather than snap),
// and a FLIP-based sheet transition that grows the sheet out of whatever
// button opened it, instead of a generic slide-up. Both respect
// prefers-reduced-motion by skipping straight to the end state.
//
// No animation library — this genuinely is small enough to hand-roll,
// and it keeps the same zero-dependency approach as the rest of the app.

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---- Spring-driven values ----

const activeSprings = new Map(); // key -> cancel function, so re-triggering redirects instead of stacking two animations on the same thing

function cancelSpring(key) {
  activeSprings.get(key)?.();
  activeSprings.delete(key);
}

/**
 * One step of spring physics (semi-implicit Euler integration of a
 * damped harmonic oscillator toward `target`). Pure and side-effect-free
 * specifically so the physics itself is unit-tested without needing
 * requestAnimationFrame or a DOM — see motion.test.js. dt is in seconds.
 */
export function springStep({ value, velocity, target, dt, stiffness = 170, damping = 18 }) {
  const acceleration = -stiffness * (value - target) - damping * velocity;
  const newVelocity = velocity + acceleration * dt;
  const newValue = value + newVelocity * dt;
  return { value: newValue, velocity: newVelocity };
}

/** Whether a spring is close enough to target, at low enough velocity, to just snap to target and stop animating. */
export function isSpringSettled(value, velocity, target, { valueThreshold = 0.25, velocityThreshold = 0.25 } = {}) {
  return Math.abs(target - value) < valueThreshold && Math.abs(velocity) < velocityThreshold;
}

/**
 * Animates an arbitrary numeric value from `from` toward `target` using
 * springStep every frame, calling `onFrame(value)` until it settles.
 * `key` identifies this animation so a second call before the first
 * settles cancels and smoothly redirects from wherever the value
 * currently is, rather than restarting or fighting the first one — this
 * matters here since a ring or macro bar can easily get a second update
 * before the first finishes (log two things back to back).
 */
export function springTo(key, from, target, onFrame, { stiffness = 170, damping = 18 } = {}) {
  cancelSpring(key);

  if (prefersReducedMotion()) {
    onFrame(target);
    return;
  }

  let value = from;
  let velocity = 0;
  let lastTime = null;
  let raf;

  function tick(now) {
    if (lastTime === null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.064); // clamp so a backgrounded-tab gap doesn't jump the value
    lastTime = now;

    ({ value, velocity } = springStep({ value, velocity, target, dt, stiffness, damping }));

    if (isSpringSettled(value, velocity, target)) {
      onFrame(target);
      activeSprings.delete(key);
      return;
    }
    onFrame(value);
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);
  activeSprings.set(key, () => cancelAnimationFrame(raf));
}

/**
 * Convenience wrapper for the common case: animate the number displayed
 * in `el`'s text content. Reads the current displayed value back out as
 * the starting point, so this composes naturally with repeated calls.
 */
export function animateNumber(el, target, formatter = (v) => String(Math.round(v))) {
  const current = Number(String(el.textContent).replace(/[^\d.-]/g, '')) || 0;
  springTo(el, current, target, (v) => {
    el.textContent = formatter(v);
  });
}

// ---- Sheet open/close: emerges from (and returns to) its trigger ----

/**
 * Uses the FLIP technique: lay the sheet out at its real final position,
 * then immediately transform it to visually match the trigger element's
 * position/size, then animate that transform back to none. Reads as the
 * sheet growing out of the button that opened it, rather than a generic
 * slide-up with no spatial relationship to what was tapped.
 *
 * sheetEl needs `transform` free for this to work — it must not rely on
 * transform for its own centering (see .sheet's margin-based centering
 * in styles.css, which exists specifically so this doesn't conflict).
 */
export function openSheetFromElement(sheetEl, triggerEl) {
  sheetEl.style.display = 'block';

  if (prefersReducedMotion() || !triggerEl) {
    sheetEl.style.transform = 'none';
    sheetEl.style.opacity = '1';
    return;
  }

  const sheetRect = sheetEl.getBoundingClientRect();
  const triggerRect = triggerEl.getBoundingClientRect();

  const scaleX = Math.max(triggerRect.width / sheetRect.width, 0.04);
  const scaleY = Math.max(triggerRect.height / sheetRect.height, 0.04);
  const originX = triggerRect.left + triggerRect.width / 2 - (sheetRect.left + sheetRect.width / 2);
  const originY = triggerRect.top + triggerRect.height / 2 - (sheetRect.top + sheetRect.height / 2);

  sheetEl.style.transition = 'none';
  sheetEl.style.transformOrigin = 'center center';
  sheetEl.style.transform = `translate(${originX}px, ${originY}px) scale(${scaleX}, ${scaleY})`;
  sheetEl.style.opacity = '0.3';

  // Forces the browser to register the "start" position above before
  // the transition below takes effect — otherwise the two states can
  // collapse into one and the animation just never plays.
  void sheetEl.offsetHeight;

  sheetEl.style.transition = 'transform 0.46s var(--ease-spring), opacity 0.3s ease';
  sheetEl.style.transform = 'none';
  sheetEl.style.opacity = '1';
}

/**
 * The reverse: shrinks the sheet back toward the trigger that opened it
 * before hiding it. Calls onDone once the sheet is actually hidden
 * (display:none) so the caller can safely reset state.
 */
export function closeSheetToElement(sheetEl, triggerEl, onDone) {
  if (prefersReducedMotion() || !triggerEl) {
    sheetEl.style.display = 'none';
    sheetEl.style.transform = '';
    sheetEl.style.opacity = '';
    sheetEl.style.transition = '';
    onDone?.();
    return;
  }

  const sheetRect = sheetEl.getBoundingClientRect();
  const triggerRect = triggerEl.getBoundingClientRect();
  const scaleX = Math.max(triggerRect.width / sheetRect.width, 0.04);
  const scaleY = Math.max(triggerRect.height / sheetRect.height, 0.04);
  const originX = triggerRect.left + triggerRect.width / 2 - (sheetRect.left + sheetRect.width / 2);
  const originY = triggerRect.top + triggerRect.height / 2 - (sheetRect.top + sheetRect.height / 2);

  sheetEl.style.transition = 'transform 0.3s var(--ease-exit), opacity 0.22s ease';
  sheetEl.style.transformOrigin = 'center center';
  sheetEl.style.transform = `translate(${originX}px, ${originY}px) scale(${scaleX}, ${scaleY})`;
  sheetEl.style.opacity = '0';

  setTimeout(() => {
    sheetEl.style.display = 'none';
    sheetEl.style.transform = '';
    sheetEl.style.opacity = '';
    sheetEl.style.transition = '';
    onDone?.();
  }, 300);
}
