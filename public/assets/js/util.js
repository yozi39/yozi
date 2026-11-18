import { t } from './i18n.js';

export const GITHUB_URL = 'https://github.com/yozi39';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tiny DOM builder. Strings become text nodes, so user input is never parsed as HTML. */
export function el(tag, cls, children, attrs) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (children != null) node.append(...[].concat(children).filter((c) => c != null && c !== ''));
  return node;
}

export function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;
  if (id === 'top') window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
}

let toastTimer;
/** Small status message at the bottom of the screen (announced to screen readers). */
export function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
}

export async function copySiteLink() {
  const url = 'https://yozi.win/';
  try {
    await navigator.clipboard.writeText(url);
    toast(t('Copied https://yozi.win/', '已复制 https://yozi.win/'));
  } catch {
    // Fallback for browsers/contexts without the async clipboard API.
    const field = Object.assign(document.createElement('textarea'), { value: url, readOnly: true });
    field.className = 'sr-only';
    document.body.append(field);
    field.select();
    const ok = document.execCommand?.('copy');
    field.remove();
    toast(ok ? t('Copied https://yozi.win/', '已复制 https://yozi.win/') : `${t('Link', '链接')}: ${url}`);
  }
}

export function flash(node) {
  if (!node) return;
  node.classList.remove('is-flash');
  void node.offsetWidth; // restart the animation
  node.classList.add('is-flash');
  setTimeout(() => node.classList.remove('is-flash'), 1700);
}
