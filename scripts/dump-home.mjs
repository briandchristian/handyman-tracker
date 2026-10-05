import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

const candidates = [
  'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
  'C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
  'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
];
const edge = candidates.find((p) => existsSync(p));
if (!edge) {
  console.error('NO_BROWSER');
  process.exit(1);
}
console.log('BROWSER', edge);

const child = spawn(edge, [
  '--headless=new',
  '--disable-gpu',
  '--ignore-certificate-errors',
  '--virtual-time-budget=12000',
  '--enable-logging',
  '--dump-dom',
  'https://127.0.0.1:5173/',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let out = '';
let err = '';
child.stdout.on('data', (d) => { out += d.toString(); });
child.stderr.on('data', (d) => { err += d.toString(); });

const timer = setTimeout(() => {
  child.kill();
  console.error('TIMEOUT');
}, 25000);

child.on('exit', (code) => {
  clearTimeout(timer);
  writeFileSync(new URL('./home-dump.html', import.meta.url), out);
  writeFileSync(new URL('./home-dump.err', import.meta.url), err);
  console.log('EXIT', code, 'OUT', out.length, 'ERR', err.length);
  const text = out.replace(/\s+/g, ' ').slice(0, 1500);
  console.log(text);
  const interesting = err.split('\n').filter((line) => /error|exception|failed|uncaught/i.test(line)).slice(0, 30);
  console.log('ERR_HITS');
  console.log(interesting.join('\n') || '(none)');
});
