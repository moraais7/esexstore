import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', '--watch', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: '3001', STORE_PUBLIC_URL: 'http://localhost:5173', NODE_ENV: 'development' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit' }),
];
let stopping = false;
const stop = code => { if (stopping) return; stopping = true; children.forEach(child => child.kill('SIGTERM')); process.exitCode = code; };
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
children.forEach(child => child.on('exit', code => stop(code || 0)));
