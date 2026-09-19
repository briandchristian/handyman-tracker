import { existsSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Locate GitHub CLI — winget often installs gh without updating PATH on Windows.
 */
export function resolveGhExecutable() {
  const fromEnv = process.env.GH_EXE || process.env.GH_PATH;
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  if (process.platform === 'win32') {
    const winCandidates = [
      'C:\\Program Files\\GitHub CLI\\gh.exe',
      'C:\\Program Files (x86)\\GitHub CLI\\gh.exe',
    ];
    for (const candidate of winCandidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    try {
      const found = execSync('where.exe gh', { encoding: 'utf8' })
        .trim()
        .split(/\r?\n/)
        .find(Boolean);
      if (found && existsSync(found)) {
        return found;
      }
    } catch {
      /* not on PATH */
    }
  }

  return 'gh';
}
