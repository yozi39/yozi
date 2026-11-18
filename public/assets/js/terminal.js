// Browser terminal. Commands are pure text matching: nothing is executed, sent or stored.
// Commands are always English; their output follows the page language via t('English', '中文').
// The repo list is read from the "Selected Repos" card so the page stays the single source of truth.
import { el, scrollToId, GITHUB_URL } from './util.js';
import { t, lang, setLang } from './i18n.js';

const SECTIONS = { home: 'top', top: 'top', github: 'github', repos: 'repos', cp: 'cp', algorithms: 'cp', links: 'links', contact: 'links' };
const HISTORY_MAX = 50;
const LINES_MAX = 160;
const bootTime = Date.now();

export function initTerminal({ openPalette } = {}) {
  const output = document.getElementById('term-output');
  const form = document.getElementById('term-form');
  const input = document.getElementById('term-input');
  const quick = document.getElementById('term-quick');
  if (!output || !form || !input) return null;

  // Read lazily so titles/subtitles reflect the current language.
  const repos = () => [...document.querySelectorAll('.repo-list a')].map((a) => ({
    name: a.pathname.split('/').filter(Boolean).pop(),
    title: a.querySelector('b')?.textContent.trim() ?? '',
    sub: a.querySelector('small')?.textContent.trim() ?? '',
    href: a.href,
  }));

  const history = [];
  let hIndex = 0;
  let draft = '';

  // ---- output helpers -------------------------------------------------
  const print = (...nodes) => {
    output.append(...nodes);
    while (output.childElementCount > LINES_MAX) output.firstElementChild.remove();
    output.scrollTop = output.scrollHeight;
  };
  const out = (content, cls = '') => el('div', `t-out ${cls}`.trim(), content);
  const echoCmd = (text) => el('div', 't-line', [el('span', 't-prompt', '$', { 'aria-hidden': 'true' }), ' ', el('span', 't-cmd', text)]);
  const link = (href, text) => el('a', '', text, { href, target: '_blank', rel: 'noopener' });
  const span = (cls, text) => el('span', cls, text);
  const row = (mark, ...rest) => el('div', '', [span('t-acc', mark), ...rest]);

  // ---- commands (desc: [English, 中文]) ---------------------------------
  const commands = {
    help: {
      desc: ['list commands', '列出命令'],
      run: () => out(el('div', 't-grid', Object.entries(commands)
        .filter(([, c]) => !c.hidden)
        .flatMap(([name, c]) => [el('b', '', name + (c.usage ? ' ' + c.usage : '')), span('', t(...c.desc))]))),
    },
    whoami: { desc: ['who is this', '我是谁'], run: () => out('yozi') },
    about: {
      desc: ['short introduction', '简单介绍'],
      run: () => out(t(
        'I’m Yozi, a computer science student learning algorithms, C++ and software engineering.\nI practice algorithm problems and build small tools along the way.\nStill learning. Still building.',
        '我是 Yozi，一名计算机专业的学生，正在学习算法、C++ 和软件工程。\n平时刷算法题，也顺手做些小工具。\n仍在学习，仍在创造。',
      )),
    },
    ls: {
      desc: ['list files', '列出文件'], usage: '[dir]',
      args: ['repos/'],
      run: (args) => {
        const dir = (args[0] || '').replace(/\/+$/, '').replace(/^~\//, '');
        if (!dir || dir === '~' || dir === '.') return out([span('t-dir', 'repos/'), '  about.txt  goals.txt  links.txt']);
        if (dir === 'repos') return out(repos().flatMap((r, i) => [i ? '  ' : '', span('t-dir', r.name + '/')]));
        return out(t(`ls: cannot access '${args[0]}': No such file or directory`, `ls: 无法访问 '${args[0]}'：没有那个文件或目录`), 't-err');
      },
    },
    cat: {
      desc: ['print a file', '查看文件'], usage: '<file>',
      args: ['about.txt', 'goals.txt', 'links.txt'],
      run: (args) => {
        const file = (args[0] || '').replace(/^~\//, '');
        if (file === 'about.txt') { // always English: it's the "file" shown on the intro screen
          return el('div', 't-box', [
            row('> ', 'Student / Developer / Problem Solver'),
            row('> ', 'Interests: ', span('t-hl', 'Algorithms, C++, Systems, Web')),
            row('> ', 'Currently: ', span('t-hl', 'Learning, Building, Practicing'), span('t-dim', ' ...')),
          ]);
        }
        if (file === 'goals.txt') {
          return el('div', 't-box', [
            row('[ ] ', t('Master the classic algorithms & data structures', '掌握经典算法与数据结构')),
            row('[ ] ', t('Solve problems in C++ consistently', '坚持用 C++ 刷题')),
            row('[ ] ', t('Compete in algorithm contests', '参加算法竞赛')),
          ]);
        }
        if (file === 'links.txt') return out(['GitHub  ', link(GITHUB_URL, 'github.com/yozi39')]);
        if (!file) return out(t('cat: missing file operand', 'cat: 缺少文件参数'), 't-err');
        return out(t(`cat: ${file}: No such file or directory`, `cat: ${file}：没有那个文件或目录`), 't-err');
      },
    },
    tpl: {
      desc: ['search my C++ templates (learning_log)', '查我的 C++ 模板题（learning_log）'], usage: '[keyword|n|ls]',
      args: () => ['ls', ...(tplData?.items.map((i) => i.name) ?? [])],
      run: (args) => tpl(args),
    },
    repos: {
      desc: ['selected repositories', '精选仓库'],
      run: () => out(el('div', 't-grid', repos().flatMap((r) => [el('b', '', r.title), el('span', '', [r.sub, '  ', link(r.href, '↗')])]))),
    },
    cd: {
      desc: ['go to a section', '跳到某个区块'], usage: '<section>',
      args: () => ['github', 'repos', 'cp', 'links', '~'],
      run: (args) => {
        const raw = (args[0] || '~').replace(/\/+$/, '').toLowerCase();
        const target = raw === '~' || raw === '' ? 'top' : SECTIONS[raw];
        if (!target) return out(t(`cd: no such section: ${args[0]}`, `cd: 没有这个区块：${args[0]}`), 't-err');
        scrollToId(target);
        return null;
      },
    },
    neofetch: { desc: ['system info', '系统信息'], run: () => neofetch() },
    theme: {
      desc: ['switch theme', '切换主题'], usage: '[light|dark|system]',
      args: ['light', 'dark', 'system'],
      run: (args) => {
        const th = window.yoziTheme;
        if (!th) return out(t('theme: unavailable', 'theme：不可用'), 't-err');
        const want = (args[0] || 'toggle').toLowerCase();
        if (want === 'toggle') th.toggle();
        else if (['light', 'dark', 'system'].includes(want)) th.set(want);
        else return out(t('usage: theme [light|dark|system]', '用法：theme [light|dark|system]'), 't-err');
        return out(`theme → ${th.mode()}${th.mode() === 'system' ? ` (${th.resolved()})` : ''}`);
      },
    },
    lang: {
      desc: ['switch language', '切换语言'], usage: '[en|zh]',
      args: ['en', 'zh'],
      run: (args) => {
        const want = (args[0] || '').toLowerCase();
        const next = want === 'en' || want === 'zh' ? want : (lang() === 'zh' ? 'en' : 'zh');
        setLang(next);
        return out(next === 'zh' ? 'lang → 中文' : 'lang → English');
      },
    },
    github: {
      desc: ['open GitHub profile', '打开 GitHub 主页'],
      run: () => {
        window.open(GITHUB_URL, '_blank', 'noopener');
        return out([t('opening ', '正在打开 '), link(GITHUB_URL, 'github.com/yozi39'), ' …']);
      },
    },
    history: { desc: ['previous commands', '历史命令'], run: () => out(history.map((h, i) => `${String(i + 1).padStart(3)}  ${h}`).join('\n') || t('(empty)', '（空）')) },
    date: { desc: ['current date', '当前日期'], run: () => out(new Date().toLocaleString(t('en-US', 'zh-CN'))) },
    echo: { desc: ['print text', '输出文字'], usage: '<text>', run: (args, raw) => out(raw.replace(/^echo\s?/i, '')) },
    menu: { desc: ['open command menu', '打开命令菜单'], run: () => { openPalette?.(); return null; } },
    clear: { desc: ['clear screen (Ctrl+L)', '清屏（Ctrl+L）'], run: () => { output.replaceChildren(); return null; } },
    pwd: { hidden: true, run: () => out('/home/yozi') },
    sudo: { hidden: true, run: () => out(t('yozi is not in the sudoers file. This incident will not be reported.', 'yozi 不在 sudoers 文件中。此事不会被报告。'), 't-err') },
    exit: { hidden: true, run: () => out(t('There’s no escape from the browser. Try clear.', '浏览器里可逃不出去。试试 clear。')) },
    rm: { hidden: true, run: () => out(t('rm: permission denied (read-only filesystem, nice try)', 'rm: 权限不足（只读文件系统，想得美）'), 't-err') },
    vim: { hidden: true, run: () => out(t('You’re safe here. No :q! required.', '放心，这里不需要 :q!。')) },
  };
  commands.man = { hidden: true, run: () => commands.help.run() };
  commands.ll = { hidden: true, run: (a) => commands.ls.run(a) };

  // ---- tpl: template lookup ------------------------------------------------
  // Index built at deploy time by scripts/fetch_templates.py (same-origin JSON, loaded on first use).
  let tplData = null;
  let lastHits = [];
  const loadTpl = async () => {
    if (!tplData) {
      const res = await fetch('/data/templates.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      tplData = await res.json();
    }
    return tplData;
  };

  function tplShow(item) {
    const copy = el('button', 't-btn', t('copy', '复制'), { type: 'button' });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(item.code); copy.textContent = t('copied ✓', '已复制 ✓'); }
      catch { copy.textContent = t('copy failed', '复制失败'); }
      setTimeout(() => { copy.textContent = t('copy', '复制'); }, 1600);
    });
    const lines = item.code.split('\n').length - 1;
    return el('div', 't-out', [
      el('div', 't-tpl-head', [
        el('b', 't-hl', item.name),
        item.group ? span('t-dim', item.group) : null,
        span('t-dim', t(`${lines} lines`, `${lines} 行`)),
        copy,
        link(item.url, 'GitHub ↗'),
      ]),
      el('pre', 't-code', item.code.replace(/\n$/, '')),
    ]);
  }

  async function tpl(args) {
    const data = await loadTpl();
    const q = args.join(' ').trim();
    const items = data.items;
    if (!q) {
      const groups = new Map();
      items.forEach((i) => groups.set(i.group || t('general', '通用'), (groups.get(i.group || t('general', '通用')) || 0) + 1));
      return out([
        span('t-hl', 'learning_log / 模板题整理'), t(` · ${items.length} templates\n`, ` · 共 ${items.length} 份模板\n`),
        [...groups].map(([g, n]) => `${g} ${n}`).join(' · '), '\n',
        span('t-dim', t('usage: tpl <keyword>  e.g. tpl dijkstra · tpl 线段树 · tpl knapsack\n       tpl ls   list all  ·  tpl <n>  open a result',
          '用法：tpl <关键词>  例如 tpl dijkstra · tpl 线段树 · tpl knapsack\n      tpl ls  列出全部  ·  tpl <序号>  打开搜索结果')),
      ]);
    }
    if (q.toLowerCase() === 'ls') {
      lastHits = items;
      return out(items.map((i, n) => `${String(n + 1).padStart(2)} ${i.group ? i.group + '/' : ''}${i.name}`).join('\n'));
    }
    if (/^\d+$/.test(q)) {
      const hit = lastHits[Number(q) - 1];
      return hit ? tplShow(hit) : out(t('no such result; search first, e.g. tpl dp', '没有这个序号，先搜索一下，例如 tpl dp'), 't-err');
    }
    const words = q.toLowerCase().split(/\s+/);
    const scored = items.map((i) => {
      const name = i.name.toLowerCase();
      const hay = `${name} ${i.group} ${i.keys}`.toLowerCase();
      let s = 0;
      if (name === q.toLowerCase()) s = 100;
      else if (words.every((w) => name.includes(w))) s = 50 - name.length / 100;
      else if (words.every((w) => hay.includes(w))) s = 10 - name.length / 100;
      return { i, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.i);
    if (!scored.length) return out(t(`no template matches “${q}”. Try tpl ls`, `没有匹配“${q}”的模板。试试 tpl ls`), 't-err');
    if (scored.length === 1 || scored[0].name.toLowerCase() === q.toLowerCase()) return tplShow(scored[0]);
    lastHits = scored.slice(0, 20);
    return out([
      lastHits.map((i, n) => `${String(n + 1).padStart(2)} ${i.group ? i.group + '/' : ''}${i.name}`).join('\n'), '\n',
      span('t-dim', t(`${scored.length} matches · open one with tpl <n>`, `找到 ${scored.length} 个 · 用 tpl <序号> 打开`)),
    ]);
  }

  function neofetch() {
    const uptime = Math.round((Date.now() - bootTime) / 1000);
    const up = uptime < 60 ? `${uptime}s` : `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
    const art = el('pre', 't-art', ' /\\_/\\\n( o.o )\n > ^ <', { 'aria-hidden': 'true' });
    const info = el('div', 't-grid', [
      el('b', '', 'host'), span('', 'yozi.win'),
      el('b', '', 'role'), span('', t('CS student', '计算机专业学生')),
      el('b', '', 'focus'), span('', t('algorithms · C++ · software eng.', '算法 · C++ · 软件工程')),
      el('b', '', 'shell'), span('', t('yozi-sh (simulated)', 'yozi-sh（模拟）')),
      el('b', '', 'theme'), span('', window.yoziTheme?.resolved() ?? 'dark'),
      el('b', '', 'lang'), span('', lang()),
      el('b', '', 'uptime'), span('', up),
    ]);
    const wrap = el('div', 't-out');
    wrap.append(el('div', 'neo', [art, info]));
    return wrap;
  }

  // ---- run ---------------------------------------------------------------
  function run(source) {
    const raw = source.trim();
    input.value = '';
    if (!raw) return;
    if (history.at(-1) !== raw) history.push(raw);
    if (history.length > HISTORY_MAX) history.shift();
    hIndex = history.length;
    draft = '';

    form.closest('.terminal')?.classList.add('is-used'); // fade the cat once the terminal is in use
    const [name, ...args] = raw.split(/\s+/);
    const cmd = commands[name.toLowerCase()];
    if (name.toLowerCase() !== 'clear') print(echoCmd(raw));
    if (!cmd) {
      print(out([t(`command not found: ${name}. Type `, `未找到命令：${name}。输入 `), span('t-hl', 'help'), t(' for a list.', ' 查看可用命令。')], 't-err'));
      return;
    }
    const result = cmd.run(args, raw);
    if (result instanceof Promise) {
      const pending = out(t('loading…', '加载中…'), 't-dim');
      print(pending);
      result
        .then((node) => { if (node) pending.replaceWith(node); else pending.remove(); })
        .catch(() => pending.replaceWith(out(t('could not load the template index', '模板索引加载失败'), 't-err')))
        .finally(() => { output.scrollTop = output.scrollHeight; });
    } else if (result) print(result);
  }

  // ---- completion -------------------------------------------------------
  function complete() {
    const value = input.value;
    const parts = value.split(/\s+/);
    let pool;
    let prefix;
    if (parts.length <= 1) {
      pool = Object.keys(commands).filter((k) => !commands[k].hidden);
      prefix = parts[0] ?? '';
    } else {
      const a = commands[parts[0].toLowerCase()]?.args;
      pool = typeof a === 'function' ? a() : a || [];
      prefix = parts.at(-1);
    }
    const hits = pool.filter((p) => p.toLowerCase().startsWith(prefix.toLowerCase()));
    if (hits.length === 1) {
      parts[parts.length - 1] = hits[0];
      input.value = parts.join(' ') + (hits[0].endsWith('/') ? '' : ' ');
    } else if (hits.length > 1) {
      const common = hits.reduce((acc, h) => { let i = 0; while (i < acc.length && acc[i].toLowerCase() === h[i]?.toLowerCase()) i++; return acc.slice(0, i); });
      if (common.length > prefix.length) { parts[parts.length - 1] = common; input.value = parts.join(' '); }
      else { print(echoCmd(value)); print(out(hits.join('  '), 't-dim')); }
    }
  }

  // ---- events ------------------------------------------------------------
  form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Tab' && input.value.trim()) { e.preventDefault(); complete(); return; }
    if ((e.key === 'l' || e.key === 'L') && e.ctrlKey) { e.preventDefault(); output.replaceChildren(); return; }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!history.length) return;
    e.preventDefault();
    if (hIndex === history.length) draft = input.value;
    hIndex = Math.max(0, Math.min(history.length, hIndex + (e.key === 'ArrowUp' ? -1 : 1)));
    input.value = history[hIndex] ?? draft;
    requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
  });
  // Clicking the terminal body focuses the prompt (but don't steal text selection or link clicks).
  document.getElementById('term-body')?.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input') || String(getSelection())) return;
    input.focus({ preventScroll: true });
  });
  quick?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (!b) return;
    run(b.dataset.cmd);
    input.focus({ preventScroll: true });
  });

  form.hidden = false;
  if (quick) quick.hidden = false;

  const focus = (prefill) => {
    scrollToId('terminal');
    setTimeout(() => {
      if (typeof prefill === 'string') input.value = prefill;
      input.focus({ preventScroll: true });
    }, 350);
  };
  return { run, focus };
}
