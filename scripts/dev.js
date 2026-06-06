#!/usr/bin/env node
/**
 * Dev launcher: starts the Expo dev server AND the neurodsp streaming controller
 * together, so simulated EEG points stream into the interface live. Ctrl-C stops
 * both. The Python controller uses the conda `cuda` env by default (override with
 * PYTHON=...). If the controller can't start, the app still runs.
 *
 *   npm run dev      -> Expo + neurodsp stream
 *   npm run stream   -> neurodsp stream only
 */
const { spawn } = require('child_process');
const fs = require('fs');

const CUDA = '/opt/homebrew/Caskroom/miniforge/base/envs/cuda/bin/python';
const python = process.env.PYTHON || (fs.existsSync(CUDA) ? CUDA : 'python3');
const streamOnly = process.argv.includes('--stream');

const procs = [];
let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    try {
      p.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function startStream() {
  console.log(`[dev] neurodsp stream via ${python}`);
  const p = spawn(python, ['-m', 'pipeline.controller'], { env: { ...process.env, PYTHONPATH: '.' } });
  const pipe = (buf) =>
    buf
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((l) => console.log(`[stream] ${l}`));
  p.stdout.on('data', pipe);
  p.stderr.on('data', pipe);
  p.on('error', (e) => console.log(`[stream] failed to start: ${e.message}`));
  p.on('exit', (c) => console.log(`[stream] exited (${c}) — the app keeps running.`));
  procs.push(p);
}

if (streamOnly) {
  startStream();
} else {
  // Expo keeps the TTY for its interactive UI (QR, key commands).
  const expo = spawn('npx', ['expo', 'start'], { stdio: 'inherit' });
  expo.on('exit', (c) => shutdown(c ?? 0));
  procs.push(expo);
  startStream();
}
