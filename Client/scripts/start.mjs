import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const directory = resolve('.next/standalone');
if (!existsSync(resolve(directory, 'server.js'))) throw new Error('Run npm run build before npm start.');
// Next's standalone server expects these assets next to its emitted server.
cpSync(resolve('public'), resolve(directory, 'public'), { recursive: true });
cpSync(resolve('.next/static'), resolve(directory, '.next/static'), { recursive: true });
const child = spawn(process.execPath, [resolve(directory, 'server.js')], { stdio: 'inherit', env: { ...process.env, HOSTNAME: process.env.HOSTNAME || '0.0.0.0' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 0; });
