import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const candidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = candidates.find((p) => existsSync(p));
const port = 9333;
const child = spawn(edge, [
  '--headless=new',
  '--disable-gpu',
  '--ignore-certificate-errors',
  `--remote-debugging-port=${port}`,
  'https://127.0.0.1:5173/',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let pages = [];
  for (let i = 0; i < 20; i += 1) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      pages = await res.json();
      if (pages.some((page) => String(page.url).includes('5173'))) break;
    } catch {
      // debugger not ready
    }
  }
  const page = pages.find((entry) => String(entry.url).includes('5173')) || pages[0];
  if (!page?.webSocketDebuggerUrl) {
    console.log('NO_PAGE', JSON.stringify(pages));
    process.exit(1);
  }
  console.log('PAGE', page.url);

  const messages = [];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      messages.push(msg);
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  await send('Log.enable');
  await sleep(3000);
  const root = await send('Runtime.evaluate', {
    expression: 'document.getElementById("root") ? document.getElementById("root").innerText.slice(0, 400) : "NO_ROOT"',
    returnByValue: true,
  });
  console.log('ROOT_TEXT', JSON.stringify(root.result?.result?.value));
  const exceptions = messages.filter((msg) => msg.method === 'Runtime.exceptionThrown' || msg.method === 'Log.entryAdded' || msg.method === 'Runtime.consoleAPICalled');
  for (const msg of exceptions) {
    console.log(msg.method, JSON.stringify(msg.params).slice(0, 1500));
  }
  if (exceptions.length === 0) console.log('NO_CONSOLE_EVENTS', messages.map((msg) => msg.method).join(','));
  ws.close();
} finally {
  child.kill();
}
