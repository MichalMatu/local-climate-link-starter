import { readFile } from 'node:fs/promises';

const [pagesPath] = process.argv.slice(2);
if (!pagesPath) {
  console.error('usage: node cdp-final-release-smoke-v1.mjs <pages.json>');
  process.exit(2);
}

const pages = JSON.parse(await readFile(pagesPath, 'utf8'));
const candidates = pages.filter(
  (candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl
);

const connect = async (url) => {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP open timeout')), 5000);
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('CDP socket error'));
      },
      { once: true }
    );
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const call = async (method, params = {}) => {
    const id = ++nextId;
    const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    socket.send(JSON.stringify({ id, method, params }));
    return result;
  };
  await opened;
  await call('Runtime.enable');
  return { socket, call };
};

const evaluate = async (call, expression) => {
  const result = await call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return result?.result?.value;
};

let session = null;
for (const candidate of candidates) {
  try {
    const current = await connect(candidate.webSocketDebuggerUrl);
    if (await evaluate(current.call, "Boolean(document.querySelector('.app-shell'))")) {
      session = current;
      break;
    }
    current.socket.close();
  } catch {
    // Try the next page target.
  }
}

if (!session) {
  console.error('no Local Climate Link app WebView found');
  process.exit(3);
}

const { socket, call } = session;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const click = async (selector) => {
  const ok = await evaluate(
    call,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`
  );
  if (!ok) throw new Error(`selector not found: ${selector}`);
};

try {
  if (!(await evaluate(call, "Boolean(document.querySelector('.dashboard-shell'))"))) {
    await click('[data-dashboard-kind="climate"]');
    await wait(300);
  }

  const dashboard = await evaluate(call, `(() => ({
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    dashboard: Boolean(document.querySelector('.dashboard-shell')),
    climateCards: document.querySelectorAll('.automation-card--climate').length,
    menuButtons: document.querySelectorAll('.automation-card--climate .automation-card__menu').length,
    bottomLabels: [...document.querySelectorAll('.app-bottom-nav__item')].map((el) => (el.textContent || '').trim()),
    climateCurrent: document.querySelector('[data-dashboard-kind="climate"]')?.getAttribute('aria-current') || null,
    topRefresh: Boolean(document.querySelector('.dashboard-refresh-action')),
    topSettings: Boolean(document.querySelector('.app-settings-trigger')),
    masterSwitch: Boolean(document.querySelector('.automation-master-switch')),
    auto: [...document.querySelectorAll('button')].some((el) => el.textContent?.trim() === 'AUTO'),
    manual: [...document.querySelectorAll('button')].some((el) => el.textContent?.trim() === 'MANUAL'),
    nonTablerSvg: document.querySelectorAll('.dashboard-shell svg:not(.tabler-icon)').length
  }))()`);

  if (!dashboard.dashboard || dashboard.climateCards < 1 || dashboard.menuButtons < 1) {
    throw new Error(`saved climate dashboard missing: ${JSON.stringify(dashboard)}`);
  }
  if (dashboard.topRefresh || dashboard.topSettings || dashboard.masterSwitch) {
    throw new Error(`legacy dashboard controls present: ${JSON.stringify(dashboard)}`);
  }
  if (!dashboard.auto || !dashboard.manual || dashboard.nonTablerSvg !== 0) {
    throw new Error(`dashboard control/icon contract failed: ${JSON.stringify(dashboard)}`);
  }
  if (dashboard.climateCurrent !== 'page') {
    throw new Error(`climate tab not current: ${JSON.stringify(dashboard)}`);
  }
  if (JSON.stringify(dashboard.bottomLabels) !== JSON.stringify(['Klimat', 'Czas', 'Ustawienia'])) {
    throw new Error(`bottom nav labels unexpected: ${JSON.stringify(dashboard)}`);
  }
  console.log(`FINAL_PHONE_DASHBOARD=${JSON.stringify(dashboard)}`);

  await click('.automation-card--climate .automation-card__menu');
  await wait(300);
  const detail = await evaluate(call, `(() => ({
    detail: Boolean(document.querySelector('.installation-detail-shell')),
    title: document.querySelector('.installation-detail-header h1')?.textContent?.trim() || null,
    bottomNav: Boolean(document.querySelector('.app-bottom-nav')),
    climateCurrent: document.querySelector('[data-dashboard-kind="climate"]')?.getAttribute('aria-current') || null,
    backLink: Boolean(document.querySelector('.installation-detail-header .detail-back-link')),
    refresh: Boolean(document.querySelector('.installation-detail-header .runtime-refresh-action')),
    dialog: Boolean(document.querySelector('[role="dialog"]')),
    nonTablerSvg: document.querySelectorAll('.installation-detail-shell svg:not(.tabler-icon)').length
  }))()`);
  if (!detail.detail || !detail.bottomNav || detail.climateCurrent !== 'page') {
    throw new Error(`climate detail navigation failed: ${JSON.stringify(detail)}`);
  }
  if (detail.backLink || detail.refresh || detail.dialog || detail.nonTablerSvg !== 0) {
    throw new Error(`climate detail hygiene failed: ${JSON.stringify(detail)}`);
  }
  console.log(`FINAL_PHONE_DETAIL=${JSON.stringify(detail)}`);

  await click('[data-dashboard-kind="settings"]');
  await wait(300);
  const settings = await evaluate(call, `(() => ({
    settings: Boolean(document.querySelector('.app-settings-screen')),
    title: document.querySelector('.app-settings-screen__header h1')?.textContent?.trim() || null,
    sections: document.querySelectorAll('.app-settings__section').length,
    diagnosticsOpen: document.querySelector('.app-settings__diagnostics')?.hasAttribute('open') || false,
    settingsCurrent: document.querySelector('[data-dashboard-kind="settings"]')?.getAttribute('aria-current') || null,
    dialog: Boolean(document.querySelector('[role="dialog"]')),
    nonTablerSvg: document.querySelectorAll('.app-settings-screen svg:not(.tabler-icon)').length
  }))()`);
  if (!settings.settings || settings.title !== 'Ustawienia' || settings.sections !== 3) {
    throw new Error(`settings page contract failed: ${JSON.stringify(settings)}`);
  }
  if (settings.diagnosticsOpen || settings.settingsCurrent !== 'page' || settings.dialog || settings.nonTablerSvg !== 0) {
    throw new Error(`settings page hygiene failed: ${JSON.stringify(settings)}`);
  }
  console.log(`FINAL_PHONE_SETTINGS=${JSON.stringify(settings)}`);

  await click('[data-dashboard-kind="climate"]');
  await wait(300);
  const returnedCards = await evaluate(
    call,
    "document.querySelectorAll('.automation-card--climate').length"
  );
  if (returnedCards < 1) {
    throw new Error('saved climate automation was not preserved after navigation');
  }
  console.log(`FINAL_PHONE_RETURNED_CARDS=${returnedCards}`);
  console.log('FINAL_PHONE_SMOKE_OK');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  socket.close();
  process.exit(4);
}

socket.close();
