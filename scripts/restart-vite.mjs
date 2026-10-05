import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const net = execSync('netstat -ano', { encoding: 'utf8' });
const pids = new Set();
for (const line of net.split(/\r?\n/)) {
  if (!line.includes(':5173') || !line.includes('LISTENING')) continue;
  const pid = line.trim().split(/\s+/).pop();
  if (pid && pid !== '0') pids.add(pid);
}
for (const pid of pids) {
  console.log('KILL', pid);
  try {
    execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
  } catch (err) {
    console.log(String(err.stdout || err.message));
  }
}

const child = spawn('npm', ['run', 'dev'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  detached: true,
  stdio: 'ignore',
  shell: true,
  windowsHide: true,
});
child.unref();
console.log('STARTED', child.pid);
