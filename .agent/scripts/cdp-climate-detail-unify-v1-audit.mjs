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
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('CDP error'));
    }, { once: true });
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
  const result = await call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
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

const openClimateDetail = async () => {
  const opened = await evalValue(session.call, `(() => {
    if (document.querySelector('.installation-detail-shell')) return true;
    const climate = document.querySelector('[data-dashboard-kind="climate"]');
    if (climate) climate.click();
    const menu = document.querySelector('.automation-card--climate .automation-card__menu');
    if (!menu) return false;
    menu.click();
    return true;
  })()`);
  if (!opened) throw new Error('climate detail entry not found');
  await new Promise((resolve) => setTimeout(resolve, 500));
};

await openClimateDetail();

if (mode === 'audit') {
  const report = await evalValue(session.call, `(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, bottom:r.bottom, right:r.right };
    };
    const settings = document.querySelector('.app-settings-trigger');
    const auto = [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === 'AUTO');
    const manual = [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === 'MANUAL');
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      shell: rect('.installation-detail-shell'),
      title: rect('.installation-detail-header h1'),
      live: rect('.installation-detail-live'),
      config: rect('.installation-detail-config'),
      nav: rect('.app-bottom-nav'),
      visibleBack: Boolean(document.querySelector('.installation-detail-header .detail-back-link')),
      visibleHeaderRefresh: Boolean(document.querySelector('.installation-detail-header .runtime-refresh-action')),
      topSettingsVisible: Boolean(settings && getComputedStyle(settings).display !== 'none'),
      tablerIcons: document.querySelectorAll('.installation-detail-shell svg.tabler-icon').length,
      nonTablerIcons: document.querySelectorAll('.installation-detail-shell svg:not(.tabler-icon)').length,
      autoManual: Boolean(auto && manual),
      climateCurrent: document.querySelector('[data-dashboard-kind="climate"]')?.getAttribute('aria-current') ?? null,
      timeNav: Boolean(document.querySelector('[data-dashboard-kind="time"]')),
      settingsNav: [...document.querySelectorAll('.app-bottom-nav button')].some((el) => el.textContent?.includes('Ustawienia'))
    };
  })()`);
  console.log(`CLIMATE_DETAIL_UNIFY=${JSON.stringify(report)}`);
  for (const key of ['shell', 'title', 'live', 'config', 'nav']) {
    if (!report[key]) throw new Error(`missing ${key}`);
  }
  if (report.visibleBack) throw new Error('visible detail back link remains');
  if (report.visibleHeaderRefresh) throw new Error('visible header refresh remains');
  if (report.topSettingsVisible) throw new Error('top settings trigger remains visible');
  if (report.tablerIcons < 4) throw new Error(`too few Tabler icons: ${report.tablerIcons}`);
  if (report.nonTablerIcons !== 0) throw new Error(`non-Tabler detail SVGs remain: ${report.nonTablerIcons}`);
  if (!report.autoManual) throw new Error('AUTO/MANUAL detail control missing');
  if (report.climateCurrent !== 'page') throw new Error('Climate bottom nav is not current');
  if (!report.timeNav || !report.settingsNav) throw new Error('bottom nav is incomplete');
  if (report.title.height > 48) throw new Error(`detail title too tall: ${report.title.height}`);
}

if (mode === 'time') {
  const clicked = await evalValue(session.call, `(() => {
    const el = document.querySelector('[data-dashboard-kind="time"]');
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error('time nav missing');
  await new Promise((resolve) => setTimeout(resolve, 300));
  const timeCurrent = await evalValue(
    session.call,
    `document.querySelector('[data-dashboard-kind="time"]')?.getAttribute('aria-current') ?? null`
  );
  if (timeCurrent !== 'page') throw new Error(`Time nav did not open Time dashboard: ${timeCurrent}`);
  console.log('CLIMATE_DETAIL_TIME_NAV_OK');
}

session.socket.close();
