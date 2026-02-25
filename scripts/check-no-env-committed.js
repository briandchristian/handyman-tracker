#!/usr/bin/env node
/**
 * Exits with error if any .env or env file with secrets is staged for commit.
 * Run before commit (e.g. npm run check-secrets) or in CI.
 * Prevents accidentally committing MONGO_URI, JWT_SECRET, etc.
 */
import { execSync } from 'child_process';

const ENV_PATTERNS = [
  /^\.env$/,
  /^\.env\./,
];

try {
  const staged = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const bad = staged.filter((path) => {
    const base = path.replace(/^.*[/\\]/, '');
    return ENV_PATTERNS.some((re) => re.test(base));
  });

  if (bad.length > 0) {
    console.error('ERROR: The following env/secret files are staged and must NOT be committed:');
    bad.forEach((f) => console.error('  -', f));
    console.error('\nUnstage them: git reset HEAD --', bad.join(' '));
    console.error('Ensure .env is in .gitignore and never add it again.');
    process.exit(1);
  }
} catch (e) {
  if (e.status === 1) {
    process.exit(1);
  }
  console.error('check-no-env-committed:', e.message);
  process.exit(2);
}
