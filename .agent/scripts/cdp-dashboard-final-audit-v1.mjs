import { readFile } from 'node:fs/promises';

const [pagesPath, target = 'audit'] = process.argv.slice(2);
if (!pagesPath || !['audit', 'time', 'climate'].includes(target)) {
  console.error('usage: node cdp-dashboard-final-audit-v1.mjs <pages.json> <audit|time|climate>');
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
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('CDP socket error'));
    }, { once: true });
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
    // Try next page.
  }
}
if (!session) {
  console.error('no Local Climate Link app WebView found');
  process.exit(3);
}

const { socket, call } = session;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const click = async (selector) => {
  const ok = await evaluate(call, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error(`selector not found: ${selector}`);
};

try {
  if (!(await evaluate(call, "Boolean(document.querySelector('.dashboard-shell'))"))) {
    throw new Error('dashboard is not active');
  }

  if (target === 'time') {
    await click('[data-dashboard-kind="time"]');
    await wait(250);
    if (!(await evaluate(call, "Boolean(document.querySelector('.dashboard-kind-empty'))"))) {
      throw new Error('time empty state did not appear');
    }
    console.log('CDP_DASHBOARD_TIME_EMPTY_OK');
  } else if (target === 'climate') {
    await click('[data-dashboard-kind="climate"]');
    await wait(250);
    if (!(await evaluate(call, "Boolean(document.querySelector('.automation-card--climate'))"))) {
      throw new Error('climate card did not appear');
    }
    console.log('CDP_DASHBOARD_CLIMATE_OK');
  } else {
    const report = await evaluate(call, `(() => {
      const visible = (el) => Boolean(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0);
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) };
      };
      const master = document.querySelector('.automation-master-switch');
      const topSettings = document.querySelector('.app-settings-trigger');
      return {
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        themeAttribute: document.documentElement.getAttribute('data-lcl-theme'),
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        background: getComputedStyle(document.body).backgroundColor,
        card: rect('.automation-card--climate'),
        leadingIcon: rect('.automation-card__leading-icon'),
        masterSwitch: rect('.automation-master-switch'),
        masterChecked: master?.getAttribute('aria-checked') ?? null,
        menu: rect('.automation-card__menu'),
        bottomNav: rect('.dashboard-bottom-nav'),
        bottomLabels: [...document.querySelectorAll('.dashboard-bottom-nav__item')].map((el) => (el.textContent || '').trim()),
        topRefreshPresent: Boolean(document.querySelector('.dashboard-refresh-action')),
        topSettingsVisible: visible(topSettings),
        autoPresent: [...document.querySelectorAll('button')].some((el) => el.textContent?.trim() === 'AUTO'),
        manualPresent: [...document.querySelectorAll('button')].some((el) => el.textContent?.trim() === 'MANUAL'),
        onPresent: [...document.querySelectorAll('button')].some((el) => el.textContent?.trim() === 'ON'),
        offPresent: [...document.querySelectorAll('button')].some((el) => el.textContent?.trim() === 'OFF')
      };
    })()`);
    if (!report.card || !report.leadingIcon || !report.masterSwitch || !report.menu || !report.bottomNav) {
      throw new Error(`dashboard final elements missing: ${JSON.stringify(report)}`);
    }
    if (report.topRefreshPresent || report.topSettingsVisible) {
      throw new Error(`legacy top actions still visible: ${JSON.stringify(report)}`);
    }
    if (!report.autoPresent || !report.manualPresent || !report.onPresent || !report.offPresent) {
      throw new Error(`dashboard controls missing: ${JSON.stringify(report)}`);
    }
    console.log(`CDP_DASHBOARD_FINAL_REPORT=${JSON.stringify(report)}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  socket.close();
  process.exit(4);
}

socket.close();
