import { readFile } from 'node:fs/promises';

const [pagesPath, selector, expectedSelector] = process.argv.slice(2);
if (!pagesPath || !selector || !expectedSelector) {
  console.error('usage: node cdp-click-selector.mjs <pages.json> <selector> <expected-selector>');
  process.exit(2);
}

const pages = JSON.parse(await readFile(pagesPath, 'utf8'));
const page = pages.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
if (!page) {
  console.error('no debuggable WebView page');
  process.exit(3);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const waitForOpen = new Promise((resolve, reject) => {
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

await waitForOpen;
await call('Runtime.enable');
const clickExpression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`;
const clicked = await call('Runtime.evaluate', {
  expression: clickExpression,
  returnByValue: true,
  awaitPromise: true
});
if (clicked?.result?.value !== 'clicked') {
  console.error(`selector not found: ${selector}`);
  socket.close();
  process.exit(4);
}

let found = false;
for (let attempt = 0; attempt < 20; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const checked = await call('Runtime.evaluate', {
    expression: `Boolean(document.querySelector(${JSON.stringify(expectedSelector)}))`,
    returnByValue: true
  });
  if (checked?.result?.value === true) {
    found = true;
    break;
  }
}

socket.close();
if (!found) {
  console.error(`expected selector not found after click: ${expectedSelector}`);
  process.exit(5);
}
console.log(`CDP_CLICK_OK ${selector} -> ${expectedSelector}`);
