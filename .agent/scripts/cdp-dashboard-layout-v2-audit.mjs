import { readFile } from 'node:fs/promises';

const [pagesPath, mode = 'audit'] = process.argv.slice(2);
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

if (mode === 'time' || mode === 'climate') {
  const selector = `[data-dashboard-kind="${mode}"]`;
  const clicked = await evalValue(session.call, `(() => { const el = document.querySelector('${selector}'); if (!el) return false; el.click(); return true; })()`);
  if (!clicked) throw new Error(`missing ${mode} nav`);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

if (mode === 'audit') {
  const report = await evalValue(session.call, `(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right };
    };
    const centerY = (r) => r ? r.y + r.height / 2 : null;
    const title = rect('.dashboard-header h1');
    const card = rect('.automation-card--climate');
    const icon = rect('.automation-card__leading-icon');
    const identity = rect('.automation-card__identity');
    const master = rect('.automation-master-switch');
    const menu = rect('.automation-card__menu');
    const main = rect('.automation-card__main');
    const modeControl = rect('.automation-card__mode-control');
    const relay = rect('.automation-card__relay-actions');
    const footer = rect('.automation-card__footer');
    const fab = rect('.dashboard-fab');
    const nav = rect('.dashboard-bottom-nav');
    const fabStyle = document.querySelector('.dashboard-fab') ? getComputedStyle(document.querySelector('.dashboard-fab')) : null;
    return {
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      tablerIcons:document.querySelectorAll('svg.tabler-icon').length,
      oldTabs:Boolean(document.querySelector('.dashboard-kind-tabs')),
      manualRefresh:Boolean(document.querySelector('.dashboard-refresh-action')),
      topSettingsVisible:Boolean(document.querySelector('.app-settings-trigger') && getComputedStyle(document.querySelector('.app-settings-trigger')).display !== 'none'),
      title, card, icon, identity, master, menu, main, modeControl, relay, footer, fab, nav,
      headerCenters:[centerY(icon),centerY(identity),centerY(master),centerY(menu)].filter((v)=>v!=null),
      fabRadius:fabStyle?.borderRadius ?? null
    };
  })()`);
  console.log(`DASHBOARD_LAYOUT_V2=${JSON.stringify(report)}`);
  const required = ['title','card','icon','identity','master','menu','main','modeControl','relay','footer','fab','nav'];
  for (const key of required) if (!report[key]) throw new Error(`missing ${key}`);
  if (report.tablerIcons < 6) throw new Error(`expected Tabler icons, got ${report.tablerIcons}`);
  if (report.oldTabs || report.manualRefresh || report.topSettingsVisible) throw new Error('old dashboard chrome still visible');
  if (report.title.height > 48) throw new Error(`dashboard title too tall: ${report.title.height}`);
  const spread = Math.max(...report.headerCenters) - Math.min(...report.headerCenters);
  if (spread > 18) throw new Error(`card header items not aligned: ${spread}`);
  if (report.card.height > 330) throw new Error(`card still too tall: ${report.card.height}`);
  if (report.modeControl.y < report.main.y - 2 || report.modeControl.bottom > report.main.bottom + 2) throw new Error('AUTO/MANUAL not in middle row');
  if (report.relay.y < report.main.bottom - 2) throw new Error('ON/OFF not below middle row');
  if (report.relay.width < report.card.width * 0.8) throw new Error('ON/OFF row not wide enough');
  if (Math.abs(report.fab.width - report.fab.height) > 2) throw new Error('FAB not square geometry');
  if (parseFloat(report.fabRadius) < report.fab.width / 2) throw new Error(`FAB not round: ${report.fabRadius}`);
}

session.socket.close();
