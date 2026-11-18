/* Runs before first paint (classic script in <head>) so there's no theme flash.
   Exposes window.yoziTheme = { mode(), resolved(), set('light'|'dark'|'system'), toggle() }. */
(() => {
  const root = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const KEY = 'yozi-theme';
  const COLORS = { dark: '#07090c', light: '#f6f5f9' };
  let mode = 'system';

  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch { /* storage may be unavailable; follow the system theme */ }

  root.classList.add('js');

  // Language: ?lang=zh|en → saved choice → browser language. i18n.js applies the text;
  // until then Chinese visitors get a hidden page instead of a flash of English.
  let lang = new URLSearchParams(location.search).get('lang');
  if (lang === 'zh' || lang === 'en') {
    try { localStorage.setItem('yozi-lang', lang); } catch { /* ignore */ }
  } else {
    try { lang = localStorage.getItem('yozi-lang'); } catch { lang = null; }
    if (lang !== 'zh' && lang !== 'en') lang = /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
  }
  root.dataset.lang = lang;
  if (lang === 'zh') {
    root.lang = 'zh-CN';
    root.classList.add('i18n-pending');
    setTimeout(() => root.classList.remove('i18n-pending'), 1500); // never stay hidden if a script fails
  }

  const resolve = () => (mode === 'system' ? (media.matches ? 'dark' : 'light') : mode);

  function apply(animate) {
    const theme = resolve();
    if (animate) {
      root.classList.add('theme-anim');
      clearTimeout(apply.t);
      apply.t = setTimeout(() => root.classList.remove('theme-anim'), 450);
    }
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = COLORS[theme];
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const zh = root.dataset.lang === 'zh';
      const label = theme === 'dark' ? (zh ? '切换到浅色模式' : 'Switch to light theme') : (zh ? '切换到深色模式' : 'Switch to dark theme');
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme, mode } }));
  }

  function set(next) {
    mode = next === 'light' || next === 'dark' ? next : 'system';
    try {
      if (mode === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch { /* keep the theme for this page view only */ }
    apply(true);
  }

  media.addEventListener('change', () => { if (mode === 'system') apply(true); });
  apply(false);

  window.yoziTheme = {
    mode: () => mode,
    resolved: resolve,
    set,
    toggle: () => set(resolve() === 'dark' ? 'light' : 'dark'),
  };
})();
