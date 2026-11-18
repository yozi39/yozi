// Entry point (ES module, deferred by default).
import { initTerminal } from './terminal.js';
import { initPalette } from './palette.js';
import { reducedMotion, copySiteLink } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Platform-aware shortcut hint (⌘ on Apple devices) */
if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $$('[data-mod]').forEach((n) => { n.textContent = '⌘'; });

/* Theme toggle button */
const themeBtn = $('#theme-toggle');
themeBtn?.addEventListener('click', () => window.yoziTheme?.toggle());
if (themeBtn && window.yoziTheme) themeBtn.setAttribute('aria-label', window.yoziTheme.resolved() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');

/* Header: solid background after scrolling */
const header = $('#site-header');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
addEventListener('scroll', onScroll, { passive: true });

/* Mobile menu */
const menuBtn = $('#menu-btn');
const menu = $('#mobile-menu');
function setMenu(open) {
  if (!menuBtn || !menu) return;
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  header?.classList.toggle('menu-open', open);
}
menuBtn?.addEventListener('click', () => setMenu(menu.hidden));
menu?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
document.addEventListener('click', (e) => { if (menu && !menu.hidden && !e.target.closest('#site-header')) setMenu(false); });
matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

/* Nav indicator + scroll spy */
const nav = $('#site-nav');
const indicator = $('.nav-indicator', nav ?? document);
const navLinks = $$('[data-nav]', nav ?? document);
const mobileLinks = $$('a[href^="#"]', menu ?? document);
let current = 'top';

function moveIndicator() {
  const link = navLinks.find((a) => a.dataset.nav === current);
  if (!indicator || !link || !nav || nav.offsetParent === null) return;
  indicator.style.setProperty('--x', `${link.offsetLeft}px`);
  indicator.style.setProperty('--w', `${link.offsetWidth}px`);
  indicator.classList.add('is-ready');
}
function setCurrent(id) {
  if (!navLinks.some((a) => a.dataset.nav === id)) return;
  current = id;
  navLinks.forEach((a) => {
    const on = a.dataset.nav === id;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  mobileLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
  moveIndicator();
}
const sections = $$('[data-section]');
function spy() {
  const line = window.innerHeight * 0.35;
  let id = 'top';
  for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.dataset.section;
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = sections.at(-1)?.dataset.section ?? id;
  if (id !== current) setCurrent(id);
}
let spyQueued = false;
addEventListener('scroll', () => {
  if (spyQueued) return;
  spyQueued = true;
  requestAnimationFrame(() => { spyQueued = false; spy(); });
}, { passive: true });
addEventListener('resize', moveIndicator);
document.fonts?.ready.then(moveIndicator);
setCurrent('top');
spy();

/* Reveal on scroll (staggered within each group) */
const revealables = $$('.reveal');
if ('IntersectionObserver' in window && !reducedMotion()) {
  const groups = new Map();
  revealables.forEach((n) => {
    const parent = n.parentElement;
    const i = groups.get(parent) ?? 0;
    groups.set(parent, i + 1);
    n.style.setProperty('--d', `${Math.min(i, 6) * 0.07}s`);
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  revealables.forEach((n) => io.observe(n));
} else {
  revealables.forEach((n) => n.classList.add('in'));
}

/* Pointer spotlight on cards (only for fine pointers) */
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.spot');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

/* Interactive pieces */
let palette;
const terminal = initTerminal({ openPalette: () => palette?.open() });
palette = initPalette({ terminal });

/* Buttons that trigger actions: data-action="terminal|theme|copy", data-run="<terminal command>" */
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  const runEl = e.target.closest('[data-run]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'terminal') terminal?.focus();
    else if (action === 'theme') window.yoziTheme?.toggle();
    else if (action === 'copy') copySiteLink();
  } else if (runEl && terminal) {
    terminal.run(runEl.dataset.run);
    terminal.focus();
  }
});
