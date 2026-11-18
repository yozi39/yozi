// English / 中文 switching.
//
// English lives in the HTML as normal. Chinese sits right next to it in attributes:
//   data-zh="…"            replaces the element's text
//   data-zh-html="…"       replaces the element's inner HTML (our own markup only)
//   data-zh-aria-label / data-zh-title / data-zh-placeholder / data-zh-content
// Strings used by scripts are written as pairs with t('English', '中文').
// The language is chosen in theme.js before first paint (?lang= → saved choice → browser language).

const KEY = 'yozi-lang';
const ATTRS = ['aria-label', 'title', 'placeholder', 'content'];
const SELECTOR = ['[data-zh]', '[data-zh-html]', ...ATTRS.map((a) => `[data-zh-${a}]`)].join(',');
const originals = new WeakMap();

export const lang = () => (document.documentElement.dataset.lang === 'zh' ? 'zh' : 'en');
export const t = (en, zh) => (lang() === 'zh' ? zh : en);

function remember(el) {
  if (originals.has(el)) return originals.get(el);
  const saved = { attrs: {} };
  if (el.hasAttribute('data-zh-html')) saved.html = el.innerHTML;
  else if (el.hasAttribute('data-zh')) saved.text = el.textContent;
  for (const a of ATTRS) if (el.hasAttribute(`data-zh-${a}`)) saved.attrs[a] = el.getAttribute(a);
  originals.set(el, saved);
  return saved;
}

function apply(next) {
  const zh = next === 'zh';
  const root = document.documentElement;
  root.dataset.lang = next;
  root.lang = zh ? 'zh-CN' : 'en';
  for (const el of document.querySelectorAll(SELECTOR)) {
    const saved = remember(el);
    if ('html' in saved) el.innerHTML = zh ? el.dataset.zhHtml : saved.html;
    else if ('text' in saved) el.textContent = zh ? el.dataset.zh : saved.text;
    for (const a of Object.keys(saved.attrs)) {
      const value = zh ? el.getAttribute(`data-zh-${a}`) : saved.attrs[a];
      if (value == null) el.removeAttribute(a);
      else el.setAttribute(a, value);
    }
  }
  root.classList.remove('i18n-pending');
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
}

export function setLang(next) {
  next = next === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem(KEY, next); } catch { /* keep for this page view */ }
  apply(next);
}

export const toggleLang = () => setLang(lang() === 'zh' ? 'en' : 'zh');

export function initI18n() {
  apply(lang());
  const btn = document.getElementById('lang-toggle');
  const label = () => btn?.setAttribute('aria-label', t('Switch to Chinese (中文)', '切换到英文（English）'));
  btn?.addEventListener('click', toggleLang);
  label();
  document.addEventListener('langchange', label);
}
