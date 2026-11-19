// Command palette (Ctrl/⌘ + K, or "/"). Accessible combobox + listbox with keyboard navigation.
import { el, scrollToId, copySiteLink, GITHUB_URL, CODE_URL, CLIP_URL } from './util.js?v=9cd0ffa3e7';
import { t, toggleLang } from './i18n.js?v=0e73d8ad65';

export function initPalette({ terminal, clawd }) {
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
  const NAV = ['Navigate', '导航'];
  const ACT = ['Actions', '操作'];
  // label / group are [English, 中文] pairs; search matches both languages.
  const buildItems = () => [
    { group: NAV, label: ['Home', '首页'], icon: 'home', hint: '#top', run: go('top') },
    { group: NAV, label: ['GitHub activity', 'GitHub 动态'], icon: 'chart', hint: '#github', keys: 'contributions graph 贡献', run: go('github') },
    { group: NAV, label: ['Algorithm journey', '算法之路'], icon: 'trophy', hint: '#cp', keys: 'cp competitive programming contests 竞赛', run: go('cp') },
    { group: NAV, label: ['Get in touch', '联系我'], icon: 'link', hint: '#links', keys: 'contact links 链接', run: go('links') },
    ...[...document.querySelectorAll('.repo-list a')].map((a) => {
      const title = a.querySelector('b')?.textContent.trim() ?? a.pathname;
      return {
        group: ['Repositories', '仓库'], label: [title, title], icon: 'github', hint: '↗',
        keys: `${a.pathname} ${a.querySelector('small')?.textContent ?? ''}`,
        run: () => window.open(a.href, '_blank', 'noopener'),
      };
    }),
    { group: ACT, label: ['Switch language: 中文 / English', '切换语言：中文 / English'], icon: 'command', keys: 'language lang chinese english 语言 中文 英文', run: toggleLang },
    { group: ACT, label: ['Toggle light / dark theme', '切换明暗主题'], icon: 'moon', keys: 'theme dark light mode 主题 深色 浅色', run: () => window.yoziTheme?.toggle() },
    { group: ACT, label: ['Use system theme', '跟随系统主题'], icon: 'sun', keys: 'theme auto system 系统', run: () => window.yoziTheme?.set('system') },
    { group: ACT, label: ['Focus the terminal', '聚焦终端'], icon: 'prompt', hint: 'shell', keys: 'terminal shell command 终端', run: () => terminal?.focus() },
    { group: ACT, label: ['Search my C++ templates', '查 C++ 模板题'], icon: 'code', hint: 'tpl', keys: 'tpl template learning_log algorithm 模板 算法', run: () => { terminal?.run('tpl'); terminal?.focus('tpl '); } },
    { group: ACT, label: ['Run neofetch', '运行 neofetch'], icon: 'prompt', keys: 'terminal info', run: () => { terminal?.run('neofetch'); terminal?.focus(); } },
    clawd ? {
      group: ACT, label: clawd.isOn() ? ['Send Clawd home', '让 Clawd 回家'] : ['Call Clawd back', '召唤 Clawd'],
      icon: 'star', hint: 'clawd', keys: 'clawd pet buddy mascot 宠物 小伙伴',
      run: () => (clawd.isOn() ? clawd.hide() : clawd.summon()),
    } : null,
    { group: ACT, label: ['Copy link to this site', '复制网站链接'], icon: 'copy', keys: 'share url clipboard 复制 分享', run: copySiteLink },
    { group: ['External', '外部链接'], label: ['Open Yozi Code (C++ workbench)', '打开 Yozi Code（C++ 刷题工作台）'], icon: 'code', hint: '↗', keys: 'yozi code ide editor compiler cpp c++ run 刷题 编辑器 工作台 运行', run: () => window.open(CODE_URL, '_blank', 'noopener') },
    { group: ['External', '外部链接'], label: ['Open Yozi Clip (phone ⇄ computer)', '打开 Yozi Clip（手机电脑互传）'], icon: 'clip', hint: '↗', keys: 'yozi clip clipboard phone iphone send transfer qr paste 剪贴板 手机 互传 传输 扫码 粘贴', run: () => window.open(CLIP_URL, '_blank', 'noopener') },
    { group: ['External', '外部链接'], label: ['Open GitHub profile', '打开 GitHub 主页'], icon: 'github', hint: '↗', keys: 'code repositories', run: () => window.open(GITHUB_URL, '_blank', 'noopener') },
  ].filter(Boolean);
  let items = buildItems();

  let visible = [];
  let active = 0;
  let opener = null;

  function score(item, q) {
    if (!q) return 1;
    const label = t(...item.label).toLowerCase();
    const hay = `${item.label.join(' ')} ${item.keys ?? ''} ${item.hint ?? ''} ${item.group.join(' ')}`.toLowerCase();
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
      list.append(el('li', 'palette-empty', t(`No results for “${input.value.trim()}”`, `没有找到“${input.value.trim()}”`), { role: 'presentation' }));
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let group = '';
    visible.forEach((it, i) => {
      if (!q && t(...it.group) !== group) {
        group = t(...it.group);
        list.append(el('li', 'palette-group', group, { role: 'presentation' }));
      }
      const li = el('li', 'palette-item', [icon(it.icon), el('span', '', t(...it.label)), it.hint ? el('span', 'pi-hint', it.hint) : null],
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
    items = buildItems();
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
