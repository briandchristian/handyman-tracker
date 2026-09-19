#!/usr/bin/env node
/**
 * One-time local sync of GitHub repo description/homepage/topics from
 * .github/repo-metadata.json (requires: gh auth login).
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const metaPath = path.resolve(process.cwd(), '.github/repo-metadata.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

const desc = meta.description.replace(/"/g, '\\"');
const homepage = meta.homepage || '';

let cmd = `gh repo edit --description "${desc}"`;
if (homepage) {
  cmd += ` --homepage "${homepage}"`;
}
if (Array.isArray(meta.topics) && meta.topics.length > 0) {
  cmd += ` --add-topic ${meta.topics.join(' --add-topic ')}`;
}

execSync(cmd, { stdio: 'inherit' });
