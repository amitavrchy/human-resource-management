import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '../../Server/node_modules/@prisma/client/index.js';
import { randomUUID } from 'node:crypto';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/(?:test|qa)/i.test(new URL(testUrl).pathname))
  throw new Error(
    'Set TEST_DATABASE_URL to the dedicated test/QA database used by the running API.',
  );
const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
const organizations: string[] = [];
const detachedUsers: string[] = [];
const password = 'Browser-test-password-2026!';
const unique = () => randomUUID().slice(0, 8);

async function createWorkspace(page: Page) {
  const slug = `browser-${unique()}`;
  const response = await page.request.post('/api/auth/register', {
    data: {
      name: 'Alex Tester',
      organizationName: 'QA Studio',
      slug,
      email: `${slug}@example.test`,
      password,
    },
  });
  expect(response.ok()).toBeTruthy();
  const me = await (await page.request.get('/api/me')).json();
  organizations.push(me.organization.id);
  return me as { organization: { id: string }; employeeId: string };
}
async function createPerson(page: Page, firstName = 'Maya') {
  const response = await page.request.post('/api/employees', {
    data: {
      firstName,
      lastName: 'Tester',
      workEmail: `${firstName.toLowerCase()}-${unique()}@example.test`,
      title: 'Product Designer',
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
const monday = () => {
  const date = new Date();
  date.setDate(date.getDate() + 8);
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

test.afterEach(async () => {
  const ids = organizations.splice(0);
  if (!ids.length) return;
  const members = await db.membership.findMany({
    where: { organizationId: { in: ids } },
    select: { userId: true },
  });
  await db.organization.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({
    where: { id: { in: [...members.map((member) => member.userId), ...detachedUsers.splice(0)] } },
  });
});
test.afterAll(async () => {
  await db.$disconnect();
});

test('registers through the UI, signs out and signs in again', async ({ page }) => {
  const slug = `browser-${unique()}`,
    email = `${slug}@example.test`;
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A better workday');
  await page.getByRole('link', { name: 'Start your workspace' }).click();
  await page.getByLabel('Your full name').fill('Alex Tester');
  await page.getByLabel('Company name').fill('QA Studio');
  await page.getByLabel('Workspace handle').fill(slug);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  organizations.push((await (await page.request.get('/api/me')).json()).organization.id);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alex');
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByText('Choose a specific workspace (optional)', { exact: true }).click();
  await page.getByLabel('Workspace handle').fill(slug);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test('creates member access, changes its role and revokes it while preserving the employee', async ({
  page,
}) => {
  await createWorkspace(page);
  const person = await createPerson(page, 'Morgan');
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Members & roles', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('Morgan Tester');
  await dialog.getByLabel('Work email', { exact: true }).fill(person.workEmail);
  await dialog.getByLabel('Initial password').fill(password);
  await dialog.getByLabel('Link employee record').selectOption(person.id);
  await dialog.getByRole('button', { name: 'Create access', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const members = await (await page.request.get('/api/members')).json();
  detachedUsers.push(
    members.find((member: { user: { email: string } }) => member.user.email === person.workEmail)
      .user.id,
  );
  await page.getByLabel('Role for Morgan Tester').selectOption('MANAGER');
  await dialog.getByRole('button', { name: 'Update role', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Role for Morgan Tester')).toHaveValue('MANAGER');
  await page.getByRole('button', { name: 'Revoke access for Morgan Tester' }).click();
  await dialog.getByRole('button', { name: 'Revoke access', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Role for Morgan Tester')).toHaveCount(0);
  expect((await page.request.get(`/api/employees/${person.id}`)).ok()).toBeTruthy();
});

for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  test(`renders every primary route at ${viewport.width}px with readable text and no page overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const session = await createWorkspace(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const routes = [
      '/app',
      '/app/directory',
      '/app/org-chart',
      '/app/time-off',
      '/app/recruiting/jobs',
      '/app/onboarding',
      '/app/documents',
      '/app/performance',
      '/app/reports',
      '/app/ai',
      '/app/settings',
      `/app/directory/${session.employeeId}`,
      `/app/onboarding/${session.employeeId}`,
    ];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('We couldn’t load this', { exact: true })).toHaveCount(0);
      const sizes = await page
        .locator('body *')
        .evaluateAll((nodes) =>
          nodes
            .filter(
              (node) =>
                node.getClientRects().length &&
                getComputedStyle(node).visibility !== 'hidden' &&
                [...node.childNodes].some(
                  (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
                ) &&
                parseFloat(getComputedStyle(node).fontSize) < 14,
            )
            .map(
              (node) =>
                `${node.tagName}: ${getComputedStyle(node).fontSize} ${node.textContent?.slice(0, 40)}`,
            ),
        );
      expect(sizes, route).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        route,
      ).toBeTruthy();
    }
    if (viewport.width < 500) {
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Workspace navigation' })
        .getByRole('link', { name: 'People', exact: true })
        .click();
      await expect(page).toHaveURL(/\/app\/directory$/);
      await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

test('creates, edits, searches and exports employees; command search supports the keyboard', async ({
  page,
}) => {
  await createWorkspace(page);
  await page.goto('/app/directory');
  await page.getByRole('button', { name: 'Add teammate', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('First name').fill('Maya');
  await dialog.getByLabel('Last name').fill('Tester');
  await dialog.getByLabel('Work email', { exact: true }).fill(`maya-${unique()}@example.test`);
  await dialog.getByLabel('Job title').fill('Product Designer');
  await dialog.getByLabel('Additional details').fill('T-shirt size: M');
  await dialog.getByRole('button', { name: 'Add teammate', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('Search people', { exact: true }).fill('Maya Tester');
  await page
    .getByRole('link', { name: /Maya Tester/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maya Tester');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('Job title').fill('Senior Product Designer');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Senior Product Designer', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Personal details', exact: true }).click();
  await expect(page.getByText('T-shirt size')).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Search people, pages or actions' }).fill('Maya Tester');
  await expect(page.getByRole('dialog').getByRole('button', { name: /Maya Tester/ })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/app/directory');
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(page.locator('.employee-grid')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('peopleos-directory.csv');
});

test('requests leave, approves it, displays it on the calendar and cancels it', async ({
  page,
}) => {
  await createWorkspace(page);
  const person = await createPerson(page);
  await page.goto('/app/time-off');
  await page.getByRole('button', { name: 'Request time off', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Request for').selectOption(person.id);
  await dialog
    .getByLabel('Leave policy')
    .selectOption({ label: 'Annual leave · 20 days available' });
  const start = monday();
  const pickerDays = dialog.locator('.rdp-day:not(.rdp-outside) .rdp-day_button');
  await pickerDays.nth(8).click();
  const rangeStart = await dialog.getByLabel('From', { exact: true }).inputValue();
  await pickerDays.nth(10).click();
  await expect(dialog.getByLabel('From', { exact: true })).toHaveValue(rangeStart);
  await expect(dialog.getByLabel('Through', { exact: true })).not.toHaveValue(rangeStart);
  await dialog.getByLabel('From', { exact: true }).fill(start);
  await dialog.getByLabel('Through', { exact: true }).fill(start);
  await dialog.getByLabel('A note for your approver').fill('A little time to recharge.');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: "Approve Maya's request" }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Approve request', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Team calendar', exact: true }).click();
  if (new Date(start).getMonth() !== new Date().getMonth())
    await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: 'Maya', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Maya Tester');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'All requests', exact: false }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Maya Tester' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel request', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
});

test('takes a role and candidate from creation through feedback, offer, hire and onboarding', async ({
  page,
}) => {
  await createWorkspace(page);
  await page.goto('/app/recruiting/jobs');
  await page.getByRole('button', { name: 'Create role', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Job title').fill('Quality Engineer');
  await dialog.getByLabel('Department', { exact: true }).fill('Engineering');
  await dialog
    .getByLabel('Job description', { exact: true })
    .fill('Build and test accessible production applications with TypeScript.');
  await dialog.getByRole('button', { name: 'Create role', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: /Quality Engineer/ }).click();
  await page.getByRole('button', { name: 'Add candidate', exact: true }).first().click();
  await page.getByLabel('Full name', { exact: true }).fill('Jamie Candidate');
  await page.getByLabel('Email', { exact: true }).fill(`jamie-${unique()}@example.test`);
  await page
    .getByLabel('Resume text', { exact: true })
    .fill('Five years of TypeScript, React and accessibility testing experience.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add candidate', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: /Jamie Candidate/ }).click();
  await page.getByLabel('Upload candidate resume').setInputFiles({
    name: 'candidate.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Five years of TypeScript, React and accessible integration testing.'),
  });
  await expect(page.getByRole('button', { name: 'Download uploaded resume' })).toBeVisible();
  await page.context().clearCookies({ name: 'peopleos_access' });
  const resumeDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download uploaded resume' }).click();
  expect((await resumeDownload).suggestedFilename()).toBe('resume.txt');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByLabel('Your notes').fill('Strong concrete examples from past projects.');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await page.getByRole('button', { name: /Interview feedback/ }).click();
  await page
    .getByLabel('Interview feedback', { exact: true })
    .fill('Demonstrated clear role-specific skills.');
  await page.getByRole('button', { name: 'Add feedback' }).click();
  await expect(page.getByText('Demonstrated clear role-specific skills.')).toBeVisible();
  await page.getByLabel('Candidate pipeline stage').selectOption('OFFER');
  await expect(page.getByRole('button', { name: 'Hire candidate' })).toBeVisible();
  await page.getByRole('button', { name: 'Hire candidate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm hire' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Open their onboarding' }).click();
  const complete = page.getByRole('button', { name: /^Complete:/ });
  for (let i = 0; i < 4; i++) {
    await complete.first().click();
    await expect(complete).toHaveCount(3 - i);
  }
  await expect(page.getByText('All set. Here’s to a great next chapter.')).toBeVisible();
});

test('saves private paperwork and handbook text, downloads it and handles unavailable AI gracefully', async ({
  page,
}) => {
  await createWorkspace(page);
  await page.goto('/app/documents');
  await page.getByRole('button', { name: 'Add document', exact: true }).first().click();
  await page.getByRole('button', { name: 'Write a document', exact: true }).click();
  await page.getByLabel('Document title').fill('QA Handbook');
  await page
    .getByLabel('Document content')
    .fill('Annual leave is twenty working days. Submit a request to your manager for approval.');
  await page.getByRole('checkbox', { name: /Make this a Copilot source/ }).check();
  await page.getByRole('button', { name: 'Save document' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Needs indexing', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('QA Handbook.txt');
  await page.goto('/app/ai');
  await page.getByLabel('Ask your company handbook').fill('How much leave do I have?');
  await page.getByRole('button', { name: 'Send policy question' }).click();
  await expect(page.getByRole('log')).toContainText("don't see that in the handbook");
  await page.goto('/app/documents');
  await page.getByRole('button', { name: 'Delete QA Handbook' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove document' }).click();
  await expect(page.getByRole('heading', { name: 'QA Handbook' })).toHaveCount(0);
});

test('renders deterministic AI drafts, batch assessments and handbook citations without a provider key', async ({
  page,
}) => {
  await createWorkspace(page);
  const markdown =
    '## Overview\nBuild accessible TypeScript products.\n## Requirements\nExperience testing real applications.';
  await page.route('**/api/ai/jd', (route) => route.fulfill({ json: { markdown } }));
  await page.goto('/app/recruiting/jobs');
  await page.getByRole('button', { name: 'Create role', exact: true }).first().click();
  await page.getByLabel('Job title', { exact: true }).fill('AI Test Engineer');
  await page.getByLabel('Department', { exact: true }).fill('Engineering');
  await page.getByRole('button', { name: 'Write with AI' }).click();
  await page.getByRole('button', { name: 'Generate description', exact: true }).click();
  await expect(page.getByLabel('Generated job description')).toHaveValue(markdown);
  await page.getByRole('button', { name: 'Use this description' }).click();
  await expect(page.getByLabel('Job description', { exact: true })).toHaveValue(markdown);
  await page.getByRole('button', { name: 'Create role', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const jobs = await (await page.request.get('/api/jobs')).json();
  const job = jobs.find((item: { title: string }) => item.title === 'AI Test Engineer');
  const candidate = await (
    await page.request.post(`/api/jobs/${job.id}/candidates`, {
      data: {
        name: 'AI Candidate',
        email: `ai-${unique()}@example.test`,
        resumeText: 'TypeScript, accessibility and integration testing experience.',
      },
    })
  ).json();
  await page.route('**/api/ai/screen-resume', async (route) => {
    expect(route.request().postDataJSON().candidateId).toBe(candidate.id);
    await route.fulfill({
      json: {
        score: 84,
        summary: 'Relevant documented experience.',
        reasons: ['TypeScript experience'],
        missingSkills: [],
      },
    });
  });
  await page.goto('/app/ai');
  await page.getByRole('button', { name: 'Resume screening', exact: true }).click();
  await page.getByLabel('Choose a role').selectOption(job.id);
  await page.getByRole('checkbox', { name: /AI Candidate/ }).check();
  await page.getByRole('button', { name: 'Screen 1 resume', exact: true }).click();
  await expect(page.getByText('84/100', { exact: true })).toBeVisible();
  await page.route('**/api/ai/chat', (route) =>
    route.fulfill({
      json: {
        answer: 'Annual leave is twenty working days.',
        citations: [
          {
            id: 'qa-chunk',
            documentId: 'qa-source',
            title: 'Annual Leave Policy',
            excerpt: 'Twenty working days per year.',
          },
        ],
      },
    }),
  );
  await page.getByRole('button', { name: 'Ask your handbook', exact: true }).click();
  await page.getByLabel('Ask your company handbook').fill('How much annual leave is available?');
  await page.getByRole('button', { name: 'Send policy question' }).click();
  await expect(page.getByRole('log')).toContainText('Annual leave is twenty working days.');
  await expect(page.getByRole('log')).toContainText('Annual Leave Policy');
});

test('persists goals and quarterly reflections', async ({ page }) => {
  await createWorkspace(page);
  await page.goto('/app/performance');
  await page.getByRole('button', { name: 'Set a goal', exact: true }).first().click();
  await page
    .getByLabel('What does success look like?')
    .fill('Launch an accessible employee workspace');
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Update progress' }).click();
  await page.getByRole('slider').press('End');
  await page.getByRole('button', { name: 'Save progress' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('100% complete')).toBeVisible();
  await page.getByRole('button', { name: 'Quarterly reflection', exact: true }).click();
  await page.getByLabel('What went well?').fill('Delivered a clear, tested workflow for our team.');
  await page
    .getByLabel('Where is there room to grow?')
    .fill('Improve the feedback loop with teammates.');
  await page.getByRole('button', { name: 'Save reflection' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Quarterly reflections/ }).click();
  await expect(page.getByText('Delivered a clear, tested workflow for our team.')).toBeVisible();
});

test('manages departments and job templates, applies presets and changes appearance', async ({
  page,
}) => {
  await createWorkspace(page);
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Departments', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Engineering');
  await page.getByRole('button', { name: 'Save department' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Engineering', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Job templates', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Engineering starter');
  await page.getByRole('dialog').getByLabel('Role title').fill('Product Engineer');
  await page.getByRole('dialog').getByLabel('Department', { exact: true }).fill('Engineering');
  await page
    .getByRole('dialog')
    .getByLabel('Job description', { exact: true })
    .fill('Build thoughtful, accessible products with our engineering team.');
  await page.getByRole('button', { name: 'Save job template' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/app/recruiting/jobs');
  await page.getByRole('button', { name: 'Create role', exact: true }).first().click();
  await page.getByLabel('Start from a template').selectOption({ label: 'Engineering starter' });
  await expect(page.getByLabel('Job title')).toHaveValue('Product Engineer');
  await page.keyboard.press('Escape');
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'My preferences', exact: true }).click();
  await page.getByLabel('Appearance').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
