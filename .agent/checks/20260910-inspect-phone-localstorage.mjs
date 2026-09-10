import { execFileSync } from 'node:child_process';

const adb = (...args) => execFileSync('adb', ['-s', 'RFCT70L7E8J', ...args], { encoding: 'utf8' }).trim();

const pid = adb('shell', 'pidof', 'link.localclimate.app').replace(/\r/g, '');
if (!pid) throw new Error('app process is not running');

const unix = adb('shell', 'cat', '/proc/net/unix');
const sockets = [...unix.matchAll(/@?(webview_devtools_remote(?:_[0-9]+)?)/g)].map((m) => m[1]);
const unique = [...new Set(sockets)];
if (unique.length === 0) throw new Error('no WebView devtools socket found');
console.log(`APP_PID=${pid}`);
console.log(`WEBVIEW_SOCKETS=${unique.join(',')}`);

let pages = null;
let chosenSocket = null;
for (const socket of unique) {
  try {
    execFileSync('adb', ['-s', 'RFCT70L7E8J', 'forward', '--remove', 'tcp:9222'], { stdio: 'ignore' });
  } catch {}
  execFileSync('adb', ['-s', 'RFCT70L7E8J', 'forward', 'tcp:9222', `localabstract:${socket}`]);
  try {
    const response = await fetch('http://127.0.0.1:9222/json');
    const candidate = await response.json();
    if (Array.isArray(candidate) && candidate.length > 0) {
      pages = candidate;
      chosenSocket = socket;
      break;
    }
  } catch {}
}
if (!pages) throw new Error('could not read any WebView CDP target');
console.log(`WEBVIEW_SOCKET=${chosenSocket}`);
const page = pages.find((p) => typeof p.url === 'string' && (p.url.includes('localhost') || p.url.includes('capacitor'))) ?? pages[0];
if (!page?.webSocketDebuggerUrl) throw new Error('no page websocket debugger URL');
console.log(`PAGE_URL=${page.url ?? ''}`);

const wsUrl = page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, 'ws://127.0.0.1:9222');
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', () => reject(new Error('CDP websocket open failed')), { once: true });
});
const id = 1;
ws.send(JSON.stringify({
  id,
  method: 'Runtime.evaluate',
  params: {
    expression: 'JSON.stringify(Object.fromEntries(Object.entries(localStorage)))',
    returnByValue: true
  }
}));
const message = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('CDP evaluate timeout')), 5000);
  ws.addEventListener('message', (event) => {
    const data = JSON.parse(String(event.data));
    if (data.id === id) {
      clearTimeout(timeout);
      resolve(data);
    }
  });
});
ws.close();
const encoded = message?.result?.result?.value;
if (typeof encoded !== 'string') throw new Error(`unexpected Runtime.evaluate response: ${JSON.stringify(message)}`);
const storage = JSON.parse(encoded);
console.log(`LOCAL_STORAGE_KEYS=${Object.keys(storage).sort().join(',')}`);
const ipv4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
for (const [key, value] of Object.entries(storage)) {
  const text = String(value);
  const matches = [...new Set(text.match(ipv4) ?? [])];
  if (matches.length > 0) console.log(`STORAGE_IPS key=${key} ips=${matches.join(',')}`);
  if (/shelly/i.test(key) || /shelly/i.test(text)) {
    const compact = text.length > 600 ? `${text.slice(0, 600)}...` : text;
    console.log(`SHELLY_STORAGE key=${key} value=${compact}`);
  }
}
