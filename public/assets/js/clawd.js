// Clawd: a small pixel buddy that wanders along the bottom of the screen.
// Click it, drag it, throw it; it naps when nobody is around. Purely decorative (aria-hidden).
// `clawd off` / `clawd on` in the terminal (or the command palette) hides / brings it back; the choice is remembered.
import { t } from './i18n.js?v=0e73d8ad65';
import { reducedMotion } from './util.js?v=0e93b6a589';

const KEY = 'yozi-clawd';
const GREETED = 'yozi-clawd-hi';
const SPEED = 46;          // walking speed, px/s
const GRAVITY = 2400;      // px/s²
const SLEEP_AFTER = 40000; // ms without any input before it naps

// 18 × 10 pixel sprite, square for square from Claude Code's welcome-screen Clawd
// ( ▐▛███▜▌ / ▝▜█████▛▘ / ▘▘ ▝▝ ): 12 × 8 body, eyes near the top, arms below them, legs in two pairs.
const SPRITE = '<svg viewBox="0 0 18 10" shape-rendering="crispEdges" aria-hidden="true" focusable="false">'
  + '<g class="c-legs c-legs-a"><rect x="4" y="8" width="1" height="2"/><rect x="11" y="8" width="1" height="2"/></g>'
  + '<g class="c-legs c-legs-b"><rect x="6" y="8" width="1" height="2"/><rect x="13" y="8" width="1" height="2"/></g>'
  + '<g class="c-arms"><rect x="1" y="4" width="2" height="2"/><rect x="15" y="4" width="2" height="2"/></g>'
  + '<rect class="c-body" x="3" y="0" width="12" height="8"/>'
  + '<g class="c-eyes"><rect x="5" y="2" width="1" height="2"/><rect x="12" y="2" width="1" height="2"/></g>'
  + '<g class="c-sleep-eyes"><rect x="4" y="3" width="2" height="1"/><rect x="12" y="3" width="2" height="1"/></g>'
  + '</svg>';

// [English, 中文]
const LINES = [
  ['Hi! I’m Clawd.', '嗨！我是 Clawd～'],
  ['Keep coding ✦', '继续写代码吧 ✦'],
  ['Next submit is AC. I can feel it.', '下一发一定 AC！'],
  ['WA? Check the edge cases.', 'WA 了？看看边界情况'],
  ['Did you remember long long?', '记得开 long long 了吗？'],
  ['Psst… try tpl in the terminal.', '悄悄说：终端里试试 tpl'],
  ['O(n log n) makes me happy.', 'O(n log n) 让我很开心'],
  ['Segment tree time?', '要不要来棵线段树？'],
  ['*click clack*', '*咔哒咔哒*'],
];
const GREET = ['Hi! Drag me around ✦', '嗨！可以拖着我玩 ✦'];
const WHEE = ['Wheee!', '哇——飞起来了！'];
const OOF = ['Oof.', '哎哟'];
const WAKE = ['Huh? I’m awake!', '嗯？我醒着呢！'];
const PESTER = ['Okay okay, I’m here!', '好啦好啦，我在呢！'];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function initClawd() {
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage unavailable: show it */ }

  const root = document.createElement('div');
  root.className = 'clawd';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="clawd-shadow"></div><div class="clawd-sprite"><div class="clawd-squash">${SPRITE}</div></div>`
    + '<div class="clawd-zzz"><span>z</span><span>z</span><span>Z</span></div><div class="clawd-bubble" hidden></div>';
  root.hidden = true;
  document.body.append(root);
  const sprite = root.querySelector('.clawd-sprite');
  const shadow = root.querySelector('.clawd-shadow');
  const bubble = root.querySelector('.clawd-bubble');

  let W = 72; let H = 40; let vw = document.documentElement.clientWidth;
  let x = 0; let h = 0; let vx = 0; let vh = 0;
  let state = 'idle';            // idle | walk | air | held | sleep
  let target = 0; let wait = 2;
  let look = 0; let lookNow = 0; let tilt = 0;
  let pointerX = null; let pointerAt = 0;
  let lastInput = performance.now();
  let placed = false; let raf = 0; let last = 0;
  let grab = null; let clicks = [];
  let talking = false; let bubbleW = 0; let bubbleTimer = 0; let lastLine = -1;
  let blinkTimer = 0; let landTimer = 0;
  let painted = { tx: '', sh: '', sp: '', look: '', bx: '' };

  const motion = () => !reducedMotion();
  const maxH = () => Math.max(0, innerHeight - H - 24);

  function measure() {
    W = sprite.offsetWidth || W;
    H = sprite.offsetHeight || H;
    vw = document.documentElement.clientWidth;
    x = clamp(x, 0, vw - W);
    h = clamp(h, 0, maxH());
  }

  function setState(next) {
    state = next;
    root.classList.toggle('is-walking', next === 'walk');
    root.classList.toggle('is-held', next === 'held');
    root.classList.toggle('is-air', next === 'air');
    root.classList.toggle('is-sleep', next === 'sleep');
  }

  function squash() {
    root.classList.remove('is-land');
    void root.offsetWidth; // restart the keyframes
    root.classList.add('is-land');
    clearTimeout(landTimer);
    landTimer = setTimeout(() => root.classList.remove('is-land'), 260);
  }

  function say(pair, ms = 2800) {
    bubble.textContent = t(...pair);
    bubble.hidden = false;
    bubbleW = bubble.offsetWidth;
    talking = true;
    placeBubble();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.hidden = true; talking = false; }, ms);
  }
  function randomLine() {
    let i;
    do i = Math.floor(Math.random() * LINES.length); while (i === lastLine && LINES.length > 1);
    lastLine = i;
    return LINES[i];
  }
  function placeBubble() {
    // Keep the bubble on screen; its tail still points at Clawd.
    const centre = x + W / 2;
    const left = clamp(centre - bubbleW / 2, 8, vw - bubbleW - 8);
    const bx = `${Math.round(left - (centre - bubbleW / 2))}px`;
    if (bx !== painted.bx) { bubble.style.setProperty('--bx', bx); painted.bx = bx; }
  }

  function hop(power = 330, side = 0) {
    if (!motion()) return;
    setState('air');
    vh = power;
    vx = side;
  }

  function decide() {
    const r = Math.random();
    if (r < 0.55) {
      const dist = rand(80, Math.min(380, vw * 0.6)) * (Math.random() < 0.5 ? -1 : 1);
      target = clamp(x + dist, 8, vw - W - 8);
      if (Math.abs(target - x) > 24) setState('walk');
    } else if (r < 0.78) {
      look = Math.random() < 0.5 ? -1 : 1;
    } else if (r < 0.88) {
      hop(280);
    } else {
      look = 0;
    }
    wait = rand(2, 5.5);
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (state === 'idle') {
      if (!talking && now - lastInput > SLEEP_AFTER) setState('sleep');
      else if (!talking && motion() && (wait -= dt) <= 0) decide();
      if (state === 'idle' && pointerX !== null && now - pointerAt < 2500) look = Math.sign(pointerX - (x + W / 2));
    } else if (state === 'walk') {
      const d = target - x;
      const step = SPEED * dt;
      look = Math.sign(d);
      if (Math.abs(d) <= step) { x = target; setState('idle'); wait = rand(1.5, 5); } else x += Math.sign(d) * step;
    } else if (state === 'air') {
      vh -= GRAVITY * dt;
      h += vh * dt;
      x += vx * dt;
      if (x < 0) { x = 0; vx = -vx * 0.5; } else if (x > vw - W) { x = vw - W; vx = -vx * 0.5; }
      if (h > maxH()) { h = maxH(); vh = Math.min(vh, 0); }
      if (h <= 0) {
        h = 0;
        squash();
        if (vh < -1100 && !talking && Math.random() < 0.6) say(OOF, 1400);
        if (vh < -520) { vh = -vh * 0.35; vx *= 0.6; } else { vh = 0; vx = 0; setState('idle'); wait = rand(1, 3); }
      }
      if (vx) look = Math.sign(vx);
    }

    const tiltTo = state === 'held' && grab ? clamp(grab.vx / 45, -24, 24) : state === 'air' ? clamp(vx / 60, -14, 14) : 0;
    tilt += (tiltTo - tilt) * Math.min(1, dt * 12);
    lookNow += (look - lookNow) * Math.min(1, dt * 10);
    paint();
  }

  function paint() {
    const tx = `translate3d(${x.toFixed(1)}px,${(-h).toFixed(1)}px,0)`;
    if (tx !== painted.tx) { root.style.transform = tx; painted.tx = tx; }
    const k = Math.max(0.35, 1 - h / 320);
    const sh = `translateY(${h.toFixed(1)}px) scale(${k.toFixed(2)})`;
    if (sh !== painted.sh) { shadow.style.transform = sh; shadow.style.opacity = String(k); painted.sh = sh; }
    const sp = Math.abs(tilt) < 0.05 ? '' : `rotate(${tilt.toFixed(1)}deg)`;
    if (sp !== painted.sp) { sprite.style.transform = sp; painted.sp = sp; }
    const lk = `${lookNow.toFixed(2)}px`;
    if (lk !== painted.look) { root.style.setProperty('--look', lk); painted.look = lk; }
    if (talking) placeBubble();
  }

  function blink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      if (!on) return;
      if (state !== 'sleep') {
        root.classList.add('blink');
        setTimeout(() => root.classList.remove('blink'), 140);
      }
      blink();
    }, rand(2200, 6000));
  }

  function wake() {
    lastInput = performance.now();
    if (state === 'sleep') { setState('idle'); wait = rand(1, 3); return true; }
    return false;
  }

  function onClick() {
    const now = performance.now();
    clicks = clicks.filter((c) => now - c < 2500).concat(now);
    if (wake()) { say(WAKE); hop(260); return; }
    if (clicks.length >= 5) { clicks = []; say(PESTER); hop(460); return; }
    say(randomLine());
    hop(300);
  }

  // ---- dragging (mouse, pen and touch) ---------------------------------------
  sprite.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { sprite.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
    const r = root.getBoundingClientRect();
    const now = performance.now();
    grab = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - x, ob: r.bottom - e.clientY,
      ground: r.bottom + h, moved: false, px: e.clientX, py: e.clientY, pt: now, vx: 0, vy: 0 };
  });
  sprite.addEventListener('pointermove', (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    if (!grab.moved) {
      if (Math.hypot(e.clientX - grab.sx, e.clientY - grab.sy) < 6) return;
      grab.moved = true;
      wake();
      setState('held');
      if (Math.random() < 0.5) say(WHEE, 1600);
    }
    const now = performance.now();
    const ms = Math.max(8, now - grab.pt);
    grab.vx += ((e.clientX - grab.px) / ms * 1000 - grab.vx) * 0.5;
    grab.vy += ((e.clientY - grab.py) / ms * 1000 - grab.vy) * 0.5;
    grab.px = e.clientX; grab.py = e.clientY; grab.pt = now;
    x = clamp(e.clientX - grab.ox, 0, vw - W);
    h = clamp(grab.ground - e.clientY - grab.ob, 0, grab.ground - H);
  });
  const release = (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    const g = grab;
    grab = null;
    if (!g.moved) { if (e.type === 'pointerup') onClick(); return; }
    const still = performance.now() - g.pt > 90; // held still before letting go: just drop
    if (!motion()) { h = 0; setState('idle'); wait = 3; return; }
    setState('air');
    vx = still ? 0 : clamp(g.vx, -1500, 1500);
    vh = still ? 0 : clamp(-g.vy, -1300, 1500);
  };
  sprite.addEventListener('pointerup', release);
  sprite.addEventListener('pointercancel', release);
  sprite.addEventListener('dragstart', (e) => e.preventDefault());

  // Any activity on the page keeps it awake; the pointer position is what it looks at.
  const active = () => { lastInput = performance.now(); if (state === 'sleep' && !grab) wake(); };
  addEventListener('pointermove', (e) => { pointerX = e.clientX; pointerAt = performance.now(); active(); }, { passive: true });
  addEventListener('pointerdown', active, { passive: true });
  addEventListener('keydown', active);
  addEventListener('scroll', active, { passive: true });
  addEventListener('resize', () => { if (on) { measure(); paint(); } });

  // ---- show / hide -----------------------------------------------------------
  function start() {
    root.hidden = false;
    measure();
    if (!placed) { x = clamp(vw - W - Math.min(96, vw * 0.1), 0, vw - W); placed = true; }
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(tick);
    blink();
  }
  function remember(value) { try { localStorage.setItem(KEY, value); } catch { /* this page view only */ } }

  function hide() {
    on = false;
    remember('off');
    cancelAnimationFrame(raf);
    clearTimeout(blinkTimer);
    clearTimeout(bubbleTimer);
    bubble.hidden = true;
    talking = false;
    grab = null;
    setState('idle');
    root.hidden = true;
  }

  /** Show it (dropping in from above) or, if it's already out, make it hop and wave. */
  function summon() {
    lastInput = performance.now();
    if (!on) {
      on = true;
      remember('on');
      h = 0;
      start();
      if (motion()) { h = Math.min(maxH(), innerHeight * 0.45); setState('air'); vh = 0; vx = 0; }
      say(LINES[0]);
      return;
    }
    wake();
    say(LINES[0]);
    hop(340);
  }

  if (on) {
    setTimeout(start, 900);
    let greeted = false;
    try { greeted = sessionStorage.getItem(GREETED) === '1'; sessionStorage.setItem(GREETED, '1'); } catch { /* ignore */ }
    if (!greeted) setTimeout(() => { if (on && !talking) say(GREET, 3400); }, 2600);
  }

  return { isOn: () => on, summon, hide };
}
