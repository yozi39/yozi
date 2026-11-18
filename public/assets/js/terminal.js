// Browser terminal. Commands are pure text matching: nothing is executed, sent or stored.
// The repo list is read from the "Selected Repos" card so the page stays the single source of truth.
import { el, scrollToId, GITHUB_URL } from './util.js';

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

  const repos = [...document.querySelectorAll('.repo-list a')].map((a) => ({
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

  // ---- commands --------------------------------------------------------
  const commands = {
    help: {
      desc: 'list commands',
      run: () => out(el('div', 't-grid', Object.entries(commands)
        .filter(([, c]) => !c.hidden)
        .flatMap(([name, c]) => [el('b', '', name + (c.usage ? ' ' + c.usage : '')), span('', c.desc)]))),
    },
    whoami: { desc: 'who is this', run: () => out('yozi') },
    about: {
      desc: 'short introduction',
      run: () => out('I’m Yozi, a computer science student learning algorithms, C++ and software engineering.\nI practice algorithm problems and build small tools along the way.\nStill learning. Still building.'),
    },
    ls: {
      desc: 'list files', usage: '[dir]',
      args: ['repos/'],
      run: (args) => {
        const dir = (args[0] || '').replace(/\/+$/, '').replace(/^~\//, '');
        if (!dir || dir === '~' || dir === '.') {
          return out([span('t-dir', 'repos/'), '  about.txt  goals.txt  links.txt']);
        }
        if (dir === 'repos') return out(repos.flatMap((r, i) => [i ? '  ' : '', span('t-dir', r.name + '/')]));
        return out(`ls: cannot access '${args[0]}': No such file or directory`, 't-err');
      },
    },
    cat: {
      desc: 'print a file', usage: '<file>',
      args: ['about.txt', 'goals.txt', 'links.txt'],
      run: (args) => {
        const file = (args[0] || '').replace(/^~\//, '');
        if (file === 'about.txt') {
          return el('div', 't-box', [
            el('div', '', [span('t-acc', '> '), 'Student / Developer / Problem Solver']),
            el('div', '', [span('t-acc', '> '), 'Interests: ', span('t-hl', 'Algorithms, C++, Systems, Web')]),
            el('div', '', [span('t-acc', '> '), 'Currently: ', span('t-hl', 'Learning, Building, Practicing'), span('t-dim', ' ...')]),
          ]);
        }
        if (file === 'links.txt') return out(['GitHub  ', link(GITHUB_URL, 'github.com/yozi39')]);
        if (file === 'goals.txt') {
          return el('div', 't-box', [
            el('div', '', [span('t-acc', '[ ] '), 'Master the classic algorithms & data structures']),
            el('div', '', [span('t-acc', '[ ] '), 'Solve problems in C++ consistently']),
            el('div', '', [span('t-acc', '[ ] '), 'Compete in algorithm contests']),
          ]);
        }
        if (!file) return out('cat: missing file operand', 't-err');
        return out(`cat: ${file}: No such file or directory`, 't-err');
      },
    },
    repos: {
      desc: 'selected repositories',
      run: () => out(el('div', 't-grid', repos.flatMap((r) => [el('b', '', r.title), el('span', '', [r.sub, '  ', link(r.href, '↗')])]))),
    },
    cd: {
      desc: 'go to a section', usage: '<section>',
      args: () => ['github', 'repos', 'cp', 'links', '~'],
      run: (args) => {
        const raw = (args[0] || '~').replace(/\/+$/, '').toLowerCase();
        const target = raw === '~' || raw === '' ? 'top' : SECTIONS[raw];
        if (!target) return out(`cd: no such section: ${args[0]}`, 't-err');
        scrollToId(target);
        return null;
      },
    },
    neofetch: { desc: 'system info', run: () => neofetch() },
    theme: {
      desc: 'switch theme', usage: '[light|dark|system]',
      args: ['light', 'dark', 'system'],
      run: (args) => {
        const t = window.yoziTheme;
        if (!t) return out('theme: unavailable', 't-err');
        const want = (args[0] || 'toggle').toLowerCase();
        if (want === 'toggle') t.toggle();
        else if (['light', 'dark', 'system'].includes(want)) t.set(want);
        else return out('usage: theme [light|dark|system]', 't-err');
        return out(`theme → ${t.mode()}${t.mode() === 'system' ? ` (${t.resolved()})` : ''}`);
      },
    },
    github: {
      desc: 'open GitHub profile',
      run: () => {
        window.open(GITHUB_URL, '_blank', 'noopener');
        return out(['opening ', link(GITHUB_URL, 'github.com/yozi39'), ' …']);
      },
    },
    history: { desc: 'previous commands', run: () => out(history.map((h, i) => `${String(i + 1).padStart(3)}  ${h}`).join('\n') || '(empty)') },
    date: { desc: 'current date', run: () => out(new Date().toString()) },
    echo: { desc: 'print text', usage: '<text>', run: (args, raw) => out(raw.replace(/^echo\s?/i, '')) },
    pwd: { desc: 'working directory', hidden: true, run: () => out('/home/yozi') },
    menu: { desc: 'open command menu', run: () => { openPalette?.(); return null; } },
    clear: { desc: 'clear screen (Ctrl+L)', run: () => { output.replaceChildren(); return null; } },
    sudo: { hidden: true, run: () => out('yozi is not in the sudoers file. This incident will not be reported.', 't-err') },
    exit: { hidden: true, run: () => out('There’s no escape from the browser. Try clear.') },
    rm: { hidden: true, run: () => out('rm: permission denied (read-only filesystem, nice try)', 't-err') },
    vim: { hidden: true, run: () => out('You’re safe here. No :q! required.') },
  };
  commands.man = { hidden: true, run: () => commands.help.run() };
  commands.ll = { hidden: true, run: (a) => commands.ls.run(a) };

  function neofetch() {
    const uptime = Math.round((Date.now() - bootTime) / 1000);
    const up = uptime < 60 ? `${uptime}s` : `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
    const art = el('pre', 't-art', ' /\\_/\\\n( o.o )\n > ^ <', { 'aria-hidden': 'true' });
    const info = el('div', 't-grid', [
      el('b', '', 'host'), span('', 'yozi.win'),
      el('b', '', 'role'), span('', 'CS student'),
      el('b', '', 'focus'), span('', 'algorithms · C++ · software eng.'),
      el('b', '', 'shell'), span('', 'yozi-sh (simulated)'),
      el('b', '', 'theme'), span('', window.yoziTheme?.resolved() ?? 'dark'),
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

    const [name, ...args] = raw.split(/\s+/);
    const cmd = commands[name.toLowerCase()];
    if (name.toLowerCase() !== 'clear') print(echoCmd(raw));
    if (!cmd) {
      print(out([`command not found: ${name}. Type `, span('t-hl', 'help'), ' for a list.'], 't-err'));
      return;
    }
    const result = cmd.run(args, raw);
    if (result) print(result);
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
      const cmd = commands[parts[0].toLowerCase()];
      const a = cmd?.args;
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
      else { print(echoCmd(value)); print(out(hits.join('  '), 't-ell')); }
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

  return { run, focus: () => { scrollToId('terminal'); setTimeout(() => input.focus({ preventScroll: true }), 350); } };
}
