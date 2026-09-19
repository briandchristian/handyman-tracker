#!/usr/bin/env node
/**
 * Local sync of GitHub repo description/homepage/topics from
 * .github/repo-metadata.json (run npm run gh:login once first).
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { resolveGhExecutable } from './resolve-gh.js';

const metaPath = path.resolve(process.cwd(), '.github/repo-metadata.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const gh = resolveGhExecutable();

const args = ['repo', 'edit', '--description', meta.description];
if (meta.homepage) {
  args.push('--homepage', meta.homepage);
}
if (Array.isArray(meta.topics)) {
  for (const topic of meta.topics) {
    args.push('--add-topic', topic);
  }
}

console.log(`Using GitHub CLI: ${gh}`);
execFileSync(gh, args, { stdio: 'inherit' });
