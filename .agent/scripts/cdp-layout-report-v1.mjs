import { readFile } from 'node:fs/promises';

const [pagesPath] = process.argv.slice(2);
if (!pagesPath) {
  console.error('usage: node cdp-layout-report-v1.mjs <pages.json>');
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

const evaluateValue = async (call, expression) => {
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
    const isApp = await evaluateValue(
      current.call,
      "Boolean(document.querySelector('.app-shell'))"
    );
    if (isApp) {
      session = current;
      break;
    }
    current.socket.close();
  } catch {
    // Try the next debuggable page.
  }
}

if (!session) {
  console.error('no Local Climate Link app WebView found');
  process.exit(3);
}

const expression = `(() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width),
      height: Math.round(r.height), bottom: Math.round(r.bottom)
    };
  };
  const info = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      selector,
      rect: rect(el),
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 220),
      display: style.display,
      gap: style.gap,
      padding: style.padding,
      fontSize: style.fontSize
    };
  };
  const cardInfo = [...document.querySelectorAll('.automation-card')].map((el, index) => ({
    index,
    rect: rect(el),
    text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 260)
  }));
  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    scroll: { y: Math.round(scrollY), height: document.documentElement.scrollHeight },
    route: document.querySelector('.installation-detail-shell') ? 'detail' : document.querySelector('.dashboard-shell') ? 'dashboard' : document.querySelector('.intent-shell') ? 'intent' : 'other',
    elements: [
      info('.app-settings-trigger'),
      info('.installation-detail-header'),
      info('.installation-detail-header h1'),
      info('.installation-detail-header .runtime-refresh-action'),
      info('.automation-status-row'),
      info('.installation-detail-grid'),
      info('.installation-detail-live'),
      info('.installation-detail-live .automation-metrics'),
      info('.installation-detail-config'),
      info('.installation-detail-device-led'),
      info('.installation-detail-actions')
    ].filter(Boolean),
    cards: cardInfo
  };
})()`;

const report = await evaluateValue(session.call, expression);
session.socket.close();
console.log(`CDP_LAYOUT_REPORT=${JSON.stringify(report)}`);
