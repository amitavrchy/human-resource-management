import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

type Agent = ReturnType<typeof request.agent>;
type Me = {
  user: { id: string };
  organization: { id: string };
  employeeId: string;
  membershipId: string;
};
const tag = randomBytes(6).toString('hex');
const password = 'Integration-test-password-2026!';
const email = (name: string) => `${name}-${tag}@example.test`;
const day = (offset: number) => {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offset);
  while (value.getUTCDay() !== 1) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};
const plusDays = (start: string, count: number) =>
  new Date(new Date(start).getTime() + count * 86400000)
    .toISOString()
    .slice(0, 10);

describe('PeopleOS real-PostgreSQL workflows', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let mock: Server;
  let uploadDir: string;
  let owner: Agent,
    other: Agent,
    employee: Agent,
    manager: Agent,
    recruiter: Agent;
  let a: Me, b: Me;
  let workerId: string, managerId: string, outsiderId: string;
  let policyId: string, jobId: string, candidateId: string, handbookId: string;
  let latestChat: { orgId: string; documentIds: string[] } | undefined;
  const userIds: string[] = [];
  const orgIds: string[] = [];

  beforeAll(async () => {
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl || !/(?:test|qa)/i.test(new URL(testUrl).pathname))
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated test/QA database. Migrate it before testing.',
      );
    process.env.DATABASE_URL = testUrl;
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    process.env.AI_SERVICE_TOKEN = randomBytes(32).toString('hex');
    process.env.NODE_ENV = 'test';
    process.env.CLIENT_ORIGIN = 'http://localhost:3000';
    uploadDir = await mkdtemp(join(tmpdir(), 'peopleos-e2e-'));
    process.env.UPLOAD_DIR = uploadDir;
    mock = createServer(async (req, res) => {
      if (
        req.headers.authorization !== `Bearer ${process.env.AI_SERVICE_TOKEN}`
      ) {
        res.writeHead(401).end();
        return;
      }
      let raw = '';
      for await (const chunk of req) raw += String(chunk);
      const body = JSON.parse(raw || '{}');
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/v1/jd/generate')
        res.end(
          JSON.stringify({
            markdown:
              '## Overview\nBuild accessible React and TypeScript applications.\n## Requirements\nRelevant practical experience.',
          }),
        );
      else if (req.url === '/v1/resume/screen')
        res.end(
          JSON.stringify({
            score: 82,
            summary: 'Documented React experience.',
            reasons: ['React and TypeScript experience is documented.'],
            missingSkills: ['No explicit testing evidence.'],
          }),
        );
      else if (req.url === '/v1/handbook/ingest')
        res.end(JSON.stringify({ chunks: 2 }));
      else if (req.url === '/v1/handbook/chat') {
        latestChat = body;
        res.end(
          JSON.stringify({
            answer: 'The handbook provides 20 days of annual leave.',
            citations: [
              {
                id: 'chunk-1',
                documentId: body.documentIds[0],
                title: 'Handbook',
                excerpt: '20 working days',
              },
              {
                id: 'foreign',
                documentId: 'other-tenant-source',
                title: 'Foreign policy',
                excerpt: 'private',
              },
            ],
          }),
        );
      } else res.writeHead(404).end('{}');
    });
    await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve));
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${(mock.address() as { port: number }).port}`;
    // Test emitted Nest decorators, rather than relying on a test transform's metadata support.
    const modulePath = '../dist/app.module.js';
    const setupPath = '../dist/setup.js';
    const prismaPath = '../dist/prisma/prisma.service.js';
    const { AppModule } = await import(modulePath);
    const { configureApp } = await import(setupPath);
    const { PrismaService } = await import(prismaPath);
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app);
    await app.init();
    db = app.get<PrismaClient>(PrismaService);
    owner = request.agent(app.getHttpServer());
    other = request.agent(app.getHttpServer());
    const register = async (agent: Agent, name: string) => {
      await agent
        .post('/auth/register')
        .send({
          name: `${name} Owner`,
          email: email(name),
          password,
          organizationName: `${name} Test Studio`,
          slug: `${name}-${tag}`,
        })
        .expect(201);
      const me = (await agent.get('/me').expect(200)).body as Me;
      orgIds.push(me.organization.id);
      userIds.push(me.user.id);
      return me;
    };
    a = await register(owner, 'alpha');
    b = await register(other, 'beta');
    policyId = (await owner.get('/leave-policies')).body.find(
      (policy: { code: string }) => policy.code === 'ANNUAL',
    ).id;
    const createPerson = async (
      name: string,
      role: string,
      managerId?: string,
    ) => {
      const person = (
        await owner
          .post('/employees')
          .send({
            firstName: name,
            lastName: 'Tester',
            workEmail: email(name),
            title: 'Engineer',
            status: 'ACTIVE',
            managerId,
            personalEmail: email(`${name}-private`),
          })
          .expect(201)
      ).body;
      const membership = (
        await owner
          .post('/members')
          .send({
            name: `${name} Tester`,
            email: email(name),
            password,
            role,
            employeeId: person.id,
          })
          .expect(201)
      ).body;
      userIds.push(membership.user.id);
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/login')
        .send({ email: email(name), password })
        .expect(201);
      return { id: person.id as string, agent };
    };
    const m = await createPerson('manager', 'MANAGER');
    manager = m.agent;
    managerId = m.id;
    const e = await createPerson('worker', 'EMPLOYEE', managerId);
    employee = e.agent;
    workerId = e.id;
    outsiderId = (
      await owner
        .post('/employees')
        .send({
          firstName: 'Outside',
          lastName: 'Team',
          workEmail: email('outside'),
        })
        .expect(201)
    ).body.id;
    const r = await createPerson('recruiter', 'RECRUITER');
    recruiter = r.agent;
    jobId = (
      await owner
        .post('/jobs')
        .send({
          title: 'React Engineer',
          descriptionMd:
            'Build accessible production React applications with TypeScript and tests.',
          status: 'OPEN',
          hiringManagerId: managerId,
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    if (db && orgIds.length) {
      await db.organization.deleteMany({ where: { id: { in: orgIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
    if (mock) await new Promise<void>((resolve) => mock.close(() => resolve()));
    if (uploadDir) {
      for (const file of await readdir(uploadDir))
        await unlink(join(uploadDir, file));
      await rmdir(uploadDir);
    }
  });

  it('requires authentication and rejects forged origin and unknown fields', async () => {
    await request(app.getHttpServer()).get('/employees').expect(401);
    await owner
      .post('/employees')
      .set('Origin', 'https://attacker.example')
      .send({})
      .expect(403);
    await owner
      .post('/employees')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({})
      .expect(403);
    await owner
      .post('/employees')
      .send({
        firstName: 'Forged',
        lastName: 'Tenant',
        workEmail: email('forged'),
        organizationId: b.organization.id,
      })
      .expect(400);
  });
  it('blocks cross-tenant reads, writes and foreign department references', async () => {
    await other.get(`/employees/${workerId}`).expect(404);
    await other
      .patch(`/employees/${workerId}`)
      .send({ title: 'Intruder' })
      .expect(404);
    const department = (
      await other
        .post('/departments')
        .send({ name: 'Private department' })
        .expect(201)
    ).body;
    await owner
      .post('/employees')
      .send({
        firstName: 'Cross',
        lastName: 'Reference',
        workEmail: email('cross'),
        departmentId: department.id,
      })
      .expect(404);
    expect((await other.get('/employees')).body.items).toHaveLength(1);
  });
  it('enforces self/direct-report scope on profile, onboarding, balance and performance', async () => {
    await employee.get(`/employees/${outsiderId}`).expect(404);
    await manager.get(`/employees/${outsiderId}`).expect(404);
    await employee.get(`/onboarding/${outsiderId}`).expect(404);
    await manager.get(`/leave-balances?employeeId=${outsiderId}`).expect(404);
    await employee
      .post('/goals')
      .send({ employeeId: outsiderId, title: 'Unauthorized goal' })
      .expect(404);
    const profile = (await manager.get(`/employees/${workerId}`).expect(200))
      .body;
    expect(profile.personalEmail).toBeUndefined();
    expect(profile.birthDate).toBeUndefined();
    expect(
      (await employee.get(`/employees/${workerId}`)).body.personalEmail,
    ).toBe(email('worker-private'));
    await employee
      .patch(`/employees/${workerId}`)
      .send({ title: 'CEO' })
      .expect(400);
    await employee
      .patch(`/employees/${workerId}`)
      .send({ phone: '+8801700000000' })
      .expect(200);
  });
  it('prevents reporting cycles and owner self-archival', async () => {
    await owner
      .patch(`/employees/${managerId}`)
      .send({ managerId: workerId })
      .expect(409);
    await owner
      .patch(`/employees/${a.employeeId}`)
      .send({ status: 'TERMINATED' })
      .expect(409);
    await owner
      .patch(`/members/${a.membershipId}/role`)
      .send({ role: 'EMPLOYEE' })
      .expect(409);
  });
  it('supports filtered, sorted, bounded employee pagination', async () => {
    const fullNameResult = await owner
      .get('/employees?q=worker%20Tester')
      .expect(200);
    expect(fullNameResult.body.items[0].id).toBe(workerId);
    const result = (
      await owner
        .get('/employees?q=worker&limit=1&sortBy=firstName&sortOrder=desc')
        .expect(200)
    ).body;
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(workerId);
    await owner.get('/employees?limit=1000').expect(400);
  });
  it('deducts a balance exactly once for concurrent approvals and refunds once on cancellation', async () => {
    const startDate = day(10),
      endDate = plusDays(startDate, 4),
      year = startDate.slice(0, 4);
    const leave = (
      await employee
        .post('/leave-requests')
        .send({ employeeId: workerId, policyId, startDate, endDate })
        .expect(201)
    ).body;
    expect(leave.days).toBe(5);
    const outcomes = await Promise.all([
      owner.post(`/leave-requests/${leave.id}/approve`),
      owner.post(`/leave-requests/${leave.id}/approve`),
    ]);
    expect(outcomes.map((result) => result.status).sort()).toEqual([201, 409]);
    const balance = async () =>
      (await employee.get(`/leave-balances?year=${year}`)).body.find(
        (item: { policyId: string }) => item.policyId === policyId,
      ).balanceDays;
    expect(await balance()).toBe(15);
    await employee.post(`/leave-requests/${leave.id}/cancel`).expect(201);
    await employee.post(`/leave-requests/${leave.id}/cancel`).expect(409);
    expect(await balance()).toBe(20);
  });
  it('rejects overlapping/overdrawn leave; rejection preserves balance and self-approval is forbidden', async () => {
    const startDate = day(24),
      endDate = plusDays(startDate, 1);
    const leave = (
      await employee
        .post('/leave-requests')
        .send({ employeeId: workerId, policyId, startDate, endDate })
        .expect(201)
    ).body;
    await employee
      .post('/leave-requests')
      .send({ employeeId: workerId, policyId, startDate, endDate })
      .expect(409);
    await manager.post(`/leave-requests/${leave.id}/reject`).expect(201);
    const balance = (
      await employee.get(`/leave-balances?year=${startDate.slice(0, 4)}`)
    ).body.find((item: { policyId: string }) => item.policyId === policyId);
    expect(balance.balanceDays).toBe(20);
    const mine = (
      await owner
        .post('/leave-requests')
        .send({ employeeId: a.employeeId, policyId, startDate, endDate })
        .expect(201)
    ).body;
    await owner.post(`/leave-requests/${mine.id}/approve`).expect(403);
    const nextYear = new Date().getUTCFullYear() + 1;
    await employee
      .post('/leave-requests')
      .send({
        employeeId: workerId,
        policyId,
        startDate: `${nextYear}-01-01`,
        endDate: `${nextYear}-12-31`,
      })
      .expect(409);
  });
  it('allows managers to approve their reports but prevents unrelated approvals', async () => {
    const date = day(40);
    const requestBody = {
      employeeId: workerId,
      policyId,
      startDate: date,
      endDate: date,
    };
    const leave = (
      await employee.post('/leave-requests').send(requestBody).expect(201)
    ).body;
    await manager.post(`/leave-requests/${leave.id}/approve`).expect(201);
    const outsider = (
      await owner
        .post('/leave-requests')
        .send({ ...requestBody, employeeId: outsiderId })
        .expect(201)
    ).body;
    await manager.post(`/leave-requests/${outsider.id}/approve`).expect(404);
  });
  it('restricts recruiting and manager job access, including AI JD scope', async () => {
    await employee.get('/jobs').expect(403);
    await manager.get(`/jobs/${jobId}`).expect(200);
    const otherJob = (
      await owner.post('/jobs').send({
        title: 'Private role',
        descriptionMd: 'A sufficiently detailed private job description.',
        status: 'OPEN',
      })
    ).body;
    await manager.get(`/jobs/${otherJob.id}`).expect(404);
    const body = {
      title: 'Engineer',
      department: 'Engineering',
      level: 'Senior',
      mustHaves: ['React'],
      tone: 'professional',
    };
    await manager.post('/ai/jd').send(body).expect(400);
    await manager
      .post('/ai/jd')
      .send({ ...body, jobId: otherJob.id })
      .expect(404);
    expect(
      (
        await manager
          .post('/ai/jd')
          .send({ ...body, jobId })
          .expect(201)
      ).body.markdown,
    ).toContain('Overview');
    await employee.post('/ai/jd').send(body).expect(403);
  });
  it('persists AI screening and clears stale assessments when resume text changes', async () => {
    candidateId = (
      await recruiter
        .post(`/jobs/${jobId}/candidates`)
        .send({
          name: 'Candidate Example',
          email: email('candidate'),
          resumeText:
            'Five years building React and TypeScript applications with accessible components.',
        })
        .expect(201)
    ).body.id;
    await recruiter.post('/ai/screen-resume').send({ candidateId }).expect(201);
    let result = (await recruiter.get(`/candidates/${candidateId}`).expect(200))
      .body;
    expect(result.aiScore).toBe(82);
    expect(result.aiReasonsJson.reasons).toHaveLength(1);
    await other.post('/ai/screen-resume').send({ candidateId }).expect(404);
    await recruiter
      .patch(`/candidates/${candidateId}`)
      .send({
        resumeText:
          'Updated resume with React, TypeScript and testing evidence.',
      })
      .expect(200);
    result = (await recruiter.get(`/candidates/${candidateId}`)).body;
    expect(result.aiScore).toBeNull();
  });
  it('hires idempotently under concurrency and creates balances plus the default checklist', async () => {
    await recruiter
      .patch(`/candidates/${candidateId}/stage`)
      .send({ stage: 'HIRED' })
      .expect(400);
    await recruiter
      .post(`/candidates/${candidateId}/hire`)
      .send({})
      .expect(409);
    const template = (
      await owner
        .post('/onboarding-templates')
        .send({
          name: 'Custom default',
          tasks: [
            { title: 'Prepare equipment' },
            { title: 'Meet your manager' },
          ],
        })
        .expect(201)
    ).body;
    await owner
      .post(`/onboarding-templates/${template.id}/default`)
      .expect(201);
    await recruiter
      .patch(`/candidates/${candidateId}/stage`)
      .send({ stage: 'OFFER' })
      .expect(200);
    const outcomes = await Promise.all([
      recruiter.post(`/candidates/${candidateId}/hire`).send({}),
      recruiter.post(`/candidates/${candidateId}/hire`).send({}),
    ]);
    expect(outcomes.map((result) => result.status)).toEqual([201, 201]);
    expect(outcomes[0].body.id).toBe(outcomes[1].body.id);
    const id = outcomes[0].body.id;
    expect(
      await db.employee.count({
        where: {
          organizationId: a.organization.id,
          workEmail: email('candidate'),
        },
      }),
    ).toBe(1);
    const tasks = await db.onboardingTask.findMany({
      where: { employeeId: id },
    });
    expect(tasks).toHaveLength(2);
    expect(await db.leaveBalance.count({ where: { employeeId: id } })).toBe(2);
    for (const task of tasks)
      await owner
        .patch(`/onboarding/${id}`)
        .send({ taskId: task.id, status: 'DONE' })
        .expect(200);
    expect((await owner.get(`/employees/${id}`)).body.status).toBe('ACTIVE');
  });
  it('keeps private files out of other employees and handbook retrieval', async () => {
    const privateDoc = (
      await owner
        .post('/documents')
        .send({
          title: 'Private employee file',
          category: 'personal',
          employeeId: outsiderId,
          contentText:
            'Private information that must not enter handbook retrieval.',
        })
        .expect(201)
    ).body;
    await employee.get(`/documents/${privateDoc.id}/download`).expect(404);
    await other.get(`/documents/${privateDoc.id}/download`).expect(404);
    await owner
      .post('/documents')
      .send({
        title: 'Unsafe handbook',
        category: 'personal',
        employeeId: outsiderId,
        isHandbook: true,
        contentText:
          'Private information must never become an indexed company policy.',
      })
      .expect(400);
    const doc = (
      await owner
        .post('/documents')
        .send({
          title: 'Test employee handbook',
          category: 'policy',
          contentText:
            'Employees receive 20 working days of annual leave. Ask your manager for approval.',
          isHandbook: true,
        })
        .expect(201)
    ).body;
    handbookId = doc.id;
    expect(doc.ingestStatus).toBe('READY');
    await employee
      .get(`/documents/${handbookId}/download`)
      .expect(200)
      .expect('Content-Type', /octet-stream/);
    const answer = (
      await employee
        .post('/ai/chat')
        .send({ message: 'How much annual leave is available?' })
        .expect(201)
    ).body;
    expect(latestChat?.orgId).toBe(a.organization.id);
    expect(latestChat?.documentIds).toEqual([handbookId]);
    expect(answer.citations).toHaveLength(1);
    expect(answer.citations[0].documentId).toBe(handbookId);
    await owner.delete(`/documents/${handbookId}`).expect(200);
    const unknown = (
      await employee
        .post('/ai/chat')
        .send({ message: 'How much annual leave is available?' })
    ).body;
    expect(unknown.citations).toEqual([]);
    expect(unknown.answer).toContain("don't see that in the handbook");
  });
  it('validates uploaded file signatures and reports oversized uploads correctly', async () => {
    await owner
      .post('/documents/upload')
      .field('title', 'Executable payload')
      .field('category', 'policy')
      .attach('file', Buffer.from('<script>bad()</script>'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    await owner
      .post('/documents/upload')
      .field('title', 'Too large')
      .field('category', 'policy')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1, 65), {
        filename: 'large.txt',
        contentType: 'text/plain',
      })
      .expect(413);
  });
  it('scopes reports, records audited changes and preserves linked employee records on settings deletion', async () => {
    await employee.get('/reports/headcount').expect(403);
    await employee.get('/audit-logs').expect(403);
    const report = (await owner.get('/reports/headcount').expect(200)).body;
    expect(report.total).toBe(
      await db.employee.count({
        where: {
          organizationId: a.organization.id,
          status: { not: 'TERMINATED' },
        },
      }),
    );
    const audit = (await owner.get('/audit-logs?q=candidate.hired').expect(200))
      .body;
    expect(audit.total).toBe(1);
    const department = (
      await owner.post('/departments').send({ name: 'Temporary team' })
    ).body;
    await owner
      .patch(`/employees/${outsiderId}`)
      .send({ departmentId: department.id })
      .expect(200);
    await owner.delete(`/departments/${department.id}`).expect(200);
    expect(
      (await owner.get(`/employees/${outsiderId}`)).body.departmentId,
    ).toBeNull();
  });
  it('validates custom fields and required values, and isolates job templates', async () => {
    await owner
      .patch(`/employees/${workerId}`)
      .send({ customFields: { 'Shirt size': 'M' } })
      .expect(200);
    expect(
      (await employee.get(`/employees/${workerId}`)).body.customFields,
    ).toEqual({ 'Shirt size': 'M' });
    await owner
      .patch(`/employees/${workerId}`)
      .send({ customFields: { secret: { nested: true } } })
      .expect(400);
    await owner
      .patch(`/employees/${workerId}`)
      .send({ firstName: null })
      .expect(400);
    const templateBody = {
      name: 'Engineering template',
      title: 'Product Engineer',
      department: 'Engineering',
      descriptionMd: 'Build accessible, tested applications for growing teams.',
    };
    const template = (
      await owner.post('/job-templates').send(templateBody).expect(201)
    ).body;
    await employee.get('/job-templates').expect(403);
    expect(
      (await recruiter.get('/job-templates').expect(200)).body.some(
        (item: { id: string }) => item.id === template.id,
      ),
    ).toBe(true);
    await other
      .patch(`/job-templates/${template.id}`)
      .send(templateBody)
      .expect(404);
    await owner.delete(`/job-templates/${template.id}`).expect(200);
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });
  it('rotates refresh tokens and revokes access on logout and password change', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/auth/login')
      .send({ email: email('worker'), password })
      .expect(201);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    expect(
      cookies.every(
        (cookie) =>
          cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax'),
      ),
    ).toBe(true);
    const oldRefresh = cookies
      .find((cookie) => cookie.startsWith('peopleos_refresh='))!
      .split(';')[0];
    const oldAccess = cookies
      .find((cookie) => cookie.startsWith('peopleos_access='))!
      .split(';')[0];
    await agent.post('/auth/refresh').expect(201);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldRefresh)
      .expect(401);
    await agent.post('/auth/logout').expect(201);
    await request(app.getHttpServer())
      .get('/me')
      .set('Cookie', oldAccess)
      .expect(401);
    await employee
      .post('/auth/change-password')
      .send({ currentPassword: password, newPassword: password + 'new' })
      .expect(201);
    await employee.get('/me').expect(401);
    await agent
      .post('/auth/login')
      .send({ email: email('worker'), password })
      .expect(401);
    await agent
      .post('/auth/login')
      .send({ email: email('worker'), password: password + 'new' })
      .expect(201);
  });
});
