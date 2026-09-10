import { readFile } from 'node:fs/promises';

const pagesPath = process.argv[2];
if (!pagesPath) process.exit(2);
const pages = JSON.parse(await readFile(pagesPath, 'utf8'));

const connect = async (url) => {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP open timeout')), 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP error')); }, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  });
  const call = (method, params = {}) => {
    const current = ++id;
    const promise = new Promise((resolve, reject) => pending.set(current, { resolve, reject }));
    socket.send(JSON.stringify({ id: current, method, params }));
    return promise;
  };
  await call('Runtime.enable');
  return { socket, call };
};

const evalValue = async (call, expression) => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
};

let session;
for (const page of pages.filter((item) => item.type === 'page' && item.webSocketDebuggerUrl)) {
  try {
    const candidate = await connect(page.webSocketDebuggerUrl);
    if (await evalValue(candidate.call, "Boolean(document.querySelector('.app-shell'))")) {
      session = candidate;
      break;
    }
    candidate.socket.close();
  } catch {}
}
if (!session) throw new Error('app WebView not found');

const clickKind = async (kind) => {
  const clicked = await evalValue(session.call, `(() => {
    const el = document.querySelector('[data-dashboard-kind="${kind}"]');
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`${kind} nav missing`);
  await new Promise((resolve) => setTimeout(resolve, 350));
};

await clickKind('settings');

const report = await evalValue(session.call, `(() => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right };
  };
  const trigger = document.querySelector('.app-settings-trigger');
  const diagnostics = document.querySelector('.app-settings__diagnostics');
  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    screen: rect('.app-settings-screen'),
    title: rect('.app-settings-screen__header h1'),
    nav: rect('.app-bottom-nav'),
    dialog: Boolean(document.querySelector('[role="dialog"]')),
    settingsCurrent: document.querySelector('[data-dashboard-kind="settings"]')?.getAttribute('aria-current') ?? null,
    topSettingsVisible: Boolean(trigger && getComputedStyle(trigger).display !== 'none'),
    sections: document.querySelectorAll('.app-settings__section').length,
    diagnosticsClosed: Boolean(diagnostics && !diagnostics.hasAttribute('open')),
    hintPresent: Boolean(document.querySelector('.app-settings__hint')),
    tablerIcons: document.querySelectorAll('.app-settings-screen svg.tabler-icon').length,
    nonTablerIcons: document.querySelectorAll('.app-settings-screen svg:not(.tabler-icon)').length
  };
})()`);
console.log(`SETTINGS_PAGE=${JSON.stringify(report)}`);
if (!report.screen || !report.title || !report.nav) throw new Error('settings page geometry missing');
if (report.dialog) throw new Error('settings still rendered as dialog');
if (report.settingsCurrent !== 'page') throw new Error('Settings nav is not current');
if (report.topSettingsVisible) throw new Error('top settings trigger remains visible');
if (report.sections !== 3) throw new Error(`unexpected settings section count: ${report.sections}`);
if (!report.diagnosticsClosed) throw new Error('diagnostics should be collapsed initially');
if (report.hintPresent) throw new Error('redundant language hint remains');
if (report.nonTablerIcons !== 0) throw new Error(`non-Tabler settings SVGs remain: ${report.nonTablerIcons}`);
if (report.title.height > 48) throw new Error(`settings title too tall: ${report.title.height}`);

await clickKind('time');
const timeCurrent = await evalValue(session.call, `document.querySelector('[data-dashboard-kind="time"]')?.getAttribute('aria-current') ?? null`);
if (timeCurrent !== 'page') throw new Error(`Time nav failed from Settings: ${timeCurrent}`);

await clickKind('settings');
const settingsAgain = await evalValue(session.call, `document.querySelector('[data-dashboard-kind="settings"]')?.getAttribute('aria-current') ?? null`);
if (settingsAgain !== 'page') throw new Error(`Settings nav failed from Time: ${settingsAgain}`);

await clickKind('climate');
const climateCurrent = await evalValue(session.call, `document.querySelector('[data-dashboard-kind="climate"]')?.getAttribute('aria-current') ?? null`);
if (climateCurrent !== 'page') throw new Error(`Climate nav failed from Settings: ${climateCurrent}`);

await clickKind('settings');
const finalSettings = await evalValue(session.call, `document.querySelector('[data-dashboard-kind="settings"]')?.getAttribute('aria-current') ?? null`);
if (finalSettings !== 'page') throw new Error(`Settings final state failed: ${finalSettings}`);

console.log('SETTINGS_PAGE_NAV_OK');
session.socket.close();
