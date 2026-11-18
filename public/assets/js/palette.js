// Command palette (Ctrl/⌘ + K, or "/"). Accessible combobox + listbox with keyboard navigation.
import { el, scrollToId, copySiteLink, GITHUB_URL } from './util.js';

export function initPalette({ terminal }) {
  const root = document.getElementById('palette');
  const input = document.getElementById('palette-input');
  const list = document.getElementById('palette-list');
  if (!root || !input || !list) return { open() {} };

  const icon = (name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  };

  const go = (id) => () => scrollToId(id);
  const items = [
    { group: 'Navigate', label: 'Home', icon: 'home', hint: '#top', run: go('top') },
    { group: 'Navigate', label: 'GitHub activity', icon: 'chart', hint: '#github', keys: 'contributions graph', run: go('github') },
    { group: 'Navigate', label: 'Algorithm journey', icon: 'trophy', hint: '#cp', keys: 'cp competitive programming contests', run: go('cp') },
    { group: 'Navigate', label: 'Get in touch', icon: 'link', hint: '#links', keys: 'contact links', run: go('links') },
    ...[...document.querySelectorAll('.repo-list a')].map((a) => ({
      group: 'Repositories', label: a.querySelector('b')?.textContent.trim() ?? a.pathname,
      icon: 'github', hint: '↗', keys: `${a.pathname} ${a.querySelector('small')?.textContent ?? ''}`,
      run: () => window.open(a.href, '_blank', 'noopener'),
    })),
    { group: 'Actions', label: 'Toggle light / dark theme', icon: 'moon', keys: 'theme dark light mode', run: () => window.yoziTheme?.toggle() },
    { group: 'Actions', label: 'Use system theme', icon: 'sun', keys: 'theme auto system', run: () => window.yoziTheme?.set('system') },
    { group: 'Actions', label: 'Focus the terminal', icon: 'prompt', hint: 'shell', keys: 'terminal shell command', run: () => terminal?.focus() },
    { group: 'Actions', label: 'Run neofetch', icon: 'prompt', keys: 'terminal info', run: () => { terminal?.run('neofetch'); terminal?.focus(); } },
    { group: 'Actions', label: 'Copy link to this site', icon: 'copy', keys: 'share url clipboard', run: copySiteLink },
    { group: 'External', label: 'Open GitHub profile', icon: 'github', hint: '↗', keys: 'code repositories', run: () => window.open(GITHUB_URL, '_blank', 'noopener') },
  ];

  let visible = [];
  let active = 0;
  let opener = null;

  function score(item, q) {
    if (!q) return 1;
    const label = item.label.toLowerCase();
    const hay = `${label} ${item.keys ?? ''} ${item.hint ?? ''} ${item.group}`.toLowerCase();
    if (label.startsWith(q)) return 4;
    if (label.includes(q)) return 3;
    if (q.split(/\s+/).every((w) => hay.includes(w))) return 2;
    // subsequence match as a fallback (e.g. "cpt" → "Copy ... terminal")
    let i = 0;
    for (const ch of label) if (ch === q[i]) i++;
    return i === q.length ? 1 : 0;
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    visible = items.map((it) => ({ it, s: score(it, q) })).filter((x) => x.s > 0)
      .sort((a, b) => (q ? b.s - a.s : 0)).map((x) => x.it);
    active = Math.min(active, Math.max(visible.length - 1, 0));
    list.replaceChildren();
    if (!visible.length) {
      list.append(el('li', 'palette-empty', `No results for “${input.value.trim()}”`, { role: 'presentation' }));
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let group = '';
    visible.forEach((it, i) => {
      if (!q && it.group !== group) {
        group = it.group;
        list.append(el('li', 'palette-group', group, { role: 'presentation' }));
      }
      const li = el('li', 'palette-item', [icon(it.icon), el('span', '', it.label), it.hint ? el('span', 'pi-hint', it.hint) : null],
        { role: 'option', id: `pi-${i}`, 'aria-selected': String(i === active) });
      li.addEventListener('click', () => choose(i));
      li.addEventListener('pointermove', () => { if (active !== i) setActive(i, false); });
      list.append(li);
    });
    input.setAttribute('aria-activedescendant', `pi-${active}`);
  }

  function setActive(i, scroll = true) {
    if (!visible.length) return;
    active = (i + visible.length) % visible.length;
    list.querySelectorAll('[role="option"]').forEach((n) => n.setAttribute('aria-selected', String(n.id === `pi-${active}`)));
    input.setAttribute('aria-activedescendant', `pi-${active}`);
    if (scroll) document.getElementById(`pi-${active}`)?.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    const it = visible[i];
    if (!it) return;
    close(false);
    it.run();
  }

  function open() {
    if (!root.hidden) return;
    opener = document.activeElement;
    root.hidden = false;
    document.body.classList.add('no-scroll');
    input.value = '';
    active = 0;
    render();
    input.focus();
  }

  function close(restoreFocus = true) {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('no-scroll');
    if (restoreFocus && opener instanceof HTMLElement) opener.focus({ preventScroll: true });
  }

  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(visible.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') e.preventDefault(); // keep focus inside the dialog
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  root.querySelector('[data-close-palette]')?.addEventListener('click', () => close());

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); root.hidden ? open() : close(); }
    else if (e.key === '/' && !typing && root.hidden) { e.preventDefault(); open(); }
  });
  document.querySelectorAll('[data-open-palette]').forEach((b) => b.addEventListener('click', open));

  return { open, close };
}
