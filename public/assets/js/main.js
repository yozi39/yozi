// Entry point (ES module, deferred by default).
import { initTerminal } from './terminal.js?v=e4e05f5ea3';
import { initPalette } from './palette.js?v=e63c10f9ee';
import { reducedMotion, copySiteLink } from './util.js?v=9cd0ffa3e7';
import { initI18n, t } from './i18n.js?v=0e73d8ad65';
import { initClawd } from './clawd.js?v=b88f1b44dc';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Language first, so everything below starts with the right text */
initI18n();

/* Platform-aware shortcut hint (⌘ on Apple devices); re-run after a language switch rewrites the footer */
const isApple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const fixModKeys = () => { if (isApple) $$('[data-mod]').forEach((n) => { n.textContent = '⌘'; }); };
fixModKeys();

/* Theme toggle button */
const themeBtn = $('#theme-toggle');
themeBtn?.addEventListener('click', () => window.yoziTheme?.toggle());
function labelThemeBtn() {
  if (!themeBtn || !window.yoziTheme) return;
  const label = window.yoziTheme.resolved() === 'dark' ? t('Switch to light theme', '切换到浅色模式') : t('Switch to dark theme', '切换到深色模式');
  themeBtn.setAttribute('aria-label', label);
  themeBtn.title = label;
}
labelThemeBtn();
document.addEventListener('themechange', labelThemeBtn);

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
  menuBtn.setAttribute('aria-label', open ? t('Close menu', '关闭菜单') : t('Open menu', '打开菜单'));
  header?.classList.toggle('menu-open', open);
}
if (menuBtn) menuBtn.setAttribute('aria-label', t('Open menu', '打开菜单'));
document.addEventListener('langchange', () => {
  fixModKeys();
  labelThemeBtn();
  if (menu) setMenu(!menu.hidden);
  requestAnimationFrame(() => moveIndicator()); // nav labels change width
});
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
const clawd = initClawd();
const terminal = initTerminal({ openPalette: () => palette?.open(), clawd });
palette = initPalette({ terminal, clawd });

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
