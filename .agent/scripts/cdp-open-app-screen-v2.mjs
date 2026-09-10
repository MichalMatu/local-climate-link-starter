import { readFile } from 'node:fs/promises';

const [pagesPath, target] = process.argv.slice(2);
if (!pagesPath || !['intent', 'detail'].includes(target)) {
  console.error('usage: node cdp-open-app-screen-v2.mjs <pages.json> <intent|detail>');
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

const { socket, call } = session;
const has = (selector) =>
  evaluateValue(call, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
const click = async (selector) => {
  const value = await evaluateValue(
    call,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`
  );
  if (!value) throw new Error(`selector not found: ${selector}`);
};
const waitFor = async (selector, attempts = 30) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await has(selector)) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
};

try {
  if (target === 'intent') {
    if (await has('.installation-detail-shell')) {
      await click('.detail-back-link');
      await Promise.race([
        waitFor('.dashboard-shell'),
        waitFor('.intent-shell')
      ]);
    }
    if (!(await has('.intent-shell'))) {
      if (!(await has('.dashboard-shell'))) {
        throw new Error('neither dashboard nor intent screen is active');
      }
      await click('.dashboard-fab');
      if (!(await waitFor('.intent-shell'))) {
        throw new Error('intent screen did not appear');
      }
    }
    console.log('CDP_SCREEN_OK intent');
  } else {
    if (await has('.intent-shell')) {
      const manageClicked = await evaluateValue(
        call,
        `(() => { const choices = [...document.querySelectorAll('.intent-choice')]; if (choices.length < 4) return false; choices[choices.length - 1].click(); return true; })()`
      );
      if (manageClicked) await waitFor('.dashboard-shell');
    }
    if (!(await has('.installation-detail-shell'))) {
      if (!(await has('.dashboard-shell'))) {
        throw new Error('dashboard unavailable for detail navigation');
      }
      await click('.automation-card__detail-link');
      if (!(await waitFor('.installation-detail-shell'))) {
        throw new Error('detail screen did not appear');
      }
    }
    console.log('CDP_SCREEN_OK detail');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  socket.close();
  process.exit(4);
}

socket.close();
