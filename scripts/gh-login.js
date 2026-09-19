#!/usr/bin/env node
import { execFileSync } from 'child_process';
import { resolveGhExecutable } from './resolve-gh.js';

const gh = resolveGhExecutable();
console.log(`Using GitHub CLI: ${gh}`);
execFileSync(gh, ['auth', 'login'], { stdio: 'inherit' });
