#!/usr/bin/env node
/**
 * Dev launcher: starts the Expo dev server AND the neurodsp streaming controller
 * together, so simulated EEG points stream into the interface live. Ctrl-C stops
 * both. If the controller can't start, the app still runs.
 *
 *   npm run dev      -> Expo + neurodsp stream (host Python via uv venv)
 *   npm run demo     -> Expo + neurodsp stream (Docker container)
 *   npm run stream   -> neurodsp stream only (host Python)
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VENV = path.join(__dirname, '..', '.venv', 'bin', 'python');
const CUDA = '/opt/homebrew/Caskroom/miniforge/base/envs/cuda/bin/python';
const python =
  process.env.PYTHON ||
  (fs.existsSync(VENV) ? VENV : fs.existsSync(CUDA) ? CUDA : 'python3');
const streamOnly = process.argv.includes('--stream');
const dockerMode = process.argv.includes('--docker');

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
  if (dockerMode) {
    // In demo mode we started everything, so tear it all down: remove the
    // pipeline container (compose up leaves it in a stopped state otherwise)
    // and stop the Supabase local stack that `npm run demo` brought up.
    console.log('[dev] stopping pipeline container...');
    spawnSync('docker', ['compose', 'down'], { stdio: 'inherit' });
    console.log('[dev] stopping local Supabase...');
    spawnSync('supabase', ['stop'], { stdio: 'inherit' });
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function startStream() {
  const label = dockerMode ? 'docker' : 'stream';
  const [cmd, args] = dockerMode
    ? ['docker', ['compose', 'up', 'pipeline']]
    : [python, ['-m', 'pipeline.controller']];
  const env = dockerMode
    ? process.env
    : { ...process.env, PYTHONPATH: '.' };
  console.log(
    dockerMode
      ? '[dev] neurodsp stream via docker compose up pipeline'
      : `[dev] neurodsp stream via ${python}`,
  );
  const p = spawn(cmd, args, { env });
  const pipe = (buf) =>
    buf
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((l) => console.log(`[${label}] ${l}`));
  p.stdout.on('data', pipe);
  p.stderr.on('data', pipe);
  p.on('error', (e) => console.log(`[${label}] failed to start: ${e.message}`));
  p.on('exit', (c) => console.log(`[${label}] exited (${c}) — the app keeps running.`));
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
