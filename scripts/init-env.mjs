import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const secret = () => randomBytes(32).toString('hex');
const secrets = { POSTGRES_PASSWORD: secret(), JWT_SECRET: secret(), AI_SERVICE_TOKEN: secret() };
const rootPath = resolve(root, '.env');
if (existsSync(rootPath)) {
  let contents = readFileSync(rootPath, 'utf8');
  for (const key of Object.keys(secrets)) {
    const match = contents.match(new RegExp(`^${key}=([^\r\n]+)`, 'm'));
    const current = match?.[1].trim();
    if (current && !current.startsWith('replace-')) secrets[key] = current;
  }
  for (const [key, value] of Object.entries(secrets)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (!pattern.test(contents)) contents += `\n${key}=${value}\n`;
    else if (new RegExp(`^${key}=(?:replace-.*|\\s*)$`, 'm').test(contents))
      contents = contents.replace(pattern, `${key}=${value}`);
  }
  writeFileSync(rootPath, contents, { mode: 0o600 });
} else {
  let contents = readFileSync(resolve(root, '.env.example'), 'utf8');
  for (const [key, value] of Object.entries(secrets))
    contents = contents.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
  writeFileSync(rootPath, contents, { mode: 0o600, flag: 'wx' });
  console.log('Created .env with random local secrets.');
}
const database = `postgresql://peopleos:${secrets.POSTGRES_PASSWORD}@127.0.0.1:5432/peopleos?schema=public`;
for (const [file, values] of [
  [
    'Server/.env',
    {
      DATABASE_URL: database,
      JWT_SECRET: secrets.JWT_SECRET,
      AI_SERVICE_TOKEN: secrets.AI_SERVICE_TOKEN,
    },
  ],
  ['ai/.env', { AI_SERVICE_TOKEN: secrets.AI_SERVICE_TOKEN }],
  ['Client/.env.local', {}],
]) {
  const destination = resolve(root, file);
  if (existsSync(destination)) {
    console.log(`Kept existing ${file}.`);
    continue;
  }
  let contents = readFileSync(
    resolve(root, file === 'Client/.env.local' ? 'Client/.env.example' : `${file}.example`),
    'utf8',
  );
  for (const [key, value] of Object.entries(values))
    contents = contents.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
  writeFileSync(destination, contents, { mode: 0o600, flag: 'wx' });
  console.log(`Created ${file}.`);
}
console.log(
  'Existing environment files are preserved. Docker uses the root .env; native services use their own files.',
);
