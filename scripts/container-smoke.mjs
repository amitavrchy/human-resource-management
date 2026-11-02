import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

const base = process.env.SMOKE_URL ?? 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Container smoke tests are intended for an isolated loopback deployment.');
async function send(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  assert(response.ok, `${path}: HTTP ${response.status}`);
  return response;
}
await send('/login');
await send('/fonts/geist-latin.woff2');
await send('/api/health/ready');
const suffix = randomUUID().slice(0, 12);
const registered = await send('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Container Tester',
    email: `container-${suffix}@example.test`,
    password: randomBytes(24).toString('hex'),
    organizationName: 'Container QA',
    slug: `container-${suffix}`,
  }),
});
const cookies = registered.headers.getSetCookie();
assert(
  cookies.length === 2 &&
    cookies.every((value) => value.includes('HttpOnly') && value.includes('Secure')),
);
const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
const headers = { Cookie: cookie, 'Content-Type': 'application/json' };
const me = await (await send('/api/me', { headers })).json();
assert.equal(me.role, 'OWNER');
const employee = await (
  await send('/api/employees', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Container',
      lastName: 'Employee',
      workEmail: `employee-${suffix}@example.test`,
    }),
  })
).json();
const onboarding = await (await send(`/api/onboarding/${employee.id}`, { headers })).json();
assert.equal(onboarding[0].onboardingTasks.length, 4);
const document = await (
  await send('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Container file verification',
      category: 'policy',
      contentText: 'Files remain private and durable in the uploads volume.',
    }),
  })
).json();
assert(
  (await (await send(`/api/documents/${document.id}/download`, { headers })).text()).includes(
    'durable',
  ),
);
await send(`/api/documents/${document.id}`, { method: 'DELETE', headers });
await send('/api/auth/logout', { method: 'POST', headers });
console.log(
  'Container smoke passed: web/assets, database readiness, secure sessions, employee onboarding and private file storage.',
);
