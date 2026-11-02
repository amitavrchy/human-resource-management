import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_DEMO_SEED !== 'true'
)
  throw new Error('Demo seeding is disabled in production.');
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12 || Buffer.byteLength(password) > 72)
  throw new Error(
    'Set DEMO_PASSWORD to a value between 12 characters and 72 UTF-8 bytes.',
  );
const db = new PrismaClient();
const passwordHash = await hash(password, 12);
const now = new Date();
const year = now.getUTCFullYear();
const date = (offset, day = 1) =>
  new Date(Date.UTC(year, now.getUTCMonth() + offset, day));
const departments = [
  'Engineering',
  'Design',
  'Product',
  'People',
  'Sales',
  'Operations',
];
const locations = [
  ['Dhaka', 'BD'],
  ['London', 'GB'],
  ['Remote', 'US'],
];
const roster = [
  ['Alex', 'Morgan', 'Chief Executive Officer', 5, 1, null],
  ['Daniel', 'Kim', 'VP of Engineering', 0, 0, 0],
  ['Maya', 'Patel', 'Senior Product Designer', 1, 2, 0],
  ['Samira', 'Rahman', 'Talent Acquisition Lead', 3, 0, 0],
  ['James', 'Wilson', 'Frontend Engineer', 0, 1, 1],
  ['Nadia', 'Islam', 'Product Manager', 2, 0, 0],
  ['Oliver', 'Chen', 'Backend Engineer', 0, 2, 1],
  ['Ayesha', 'Khan', 'People Operations Manager', 3, 0, 0],
  ['Lucas', 'Martin', 'Brand Designer', 1, 1, 2],
  ['Zara', 'Ahmed', 'Account Executive', 4, 0, 0],
  ['Ethan', 'Park', 'Platform Engineer', 0, 2, 1],
  ['Sofia', 'Reyes', 'Customer Success Lead', 4, 1, 0],
  ['Rafi', 'Hassan', 'Finance Analyst', 5, 0, 0],
  ['Emma', 'Taylor', 'Product Researcher', 2, 1, 5],
  ['Arjun', 'Shah', 'Full Stack Engineer', 0, 2, 1],
  ['Leila', 'Noor', 'Product Designer', 1, 0, 2],
  ['Noah', 'Anderson', 'Software Engineer', 0, 2, 1],
  ['Priya', 'Das', 'People Coordinator', 3, 0, 7],
];

try {
  const org = await db.organization.upsert({
    where: { slug: 'orbit-demo' },
    update: {},
    create: {
      id: 'demo_org',
      name: 'Orbit Studio',
      slug: 'orbit-demo',
      employeeSequence: roster.length,
    },
  });
  const orgId = org.id;
  for (let i = 0; i < departments.length; i++)
    await db.department.upsert({
      where: {
        organizationId_name: { organizationId: orgId, name: departments[i] },
      },
      update: {},
      create: {
        id: `demo_dept_${i}`,
        organizationId: orgId,
        name: departments[i],
      },
    });
  for (let i = 0; i < locations.length; i++)
    await db.location.upsert({
      where: {
        organizationId_name: { organizationId: orgId, name: locations[i][0] },
      },
      update: {},
      create: {
        id: `demo_loc_${i}`,
        organizationId: orgId,
        name: locations[i][0],
        country: locations[i][1],
      },
    });
  const policies = [
    ['Annual leave', 'ANNUAL', 20],
    ['Sick leave', 'SICK', 10],
    ['Personal leave', 'PERSONAL', 5],
  ];
  for (let i = 0; i < policies.length; i++)
    await db.leavePolicy.upsert({
      where: {
        organizationId_code: { organizationId: orgId, code: policies[i][1] },
      },
      update: {},
      create: {
        id: `demo_policy_${i}`,
        organizationId: orgId,
        name: policies[i][0],
        code: policies[i][1],
        annualDays: policies[i][2],
      },
    });
  const tasks = [
    'Set up your work account',
    'Collect your laptop and equipment',
    'Read the employee handbook',
    'Meet your team and manager',
    'Complete your payroll details',
  ];
  await db.onboardingTemplate.upsert({
    where: { id: 'demo_template' },
    update: {},
    create: {
      id: 'demo_template',
      organizationId: orgId,
      name: 'The Orbit welcome',
      isDefault: true,
      tasksJson: tasks.map((title, sortOrder) => ({ title, sortOrder })),
    },
  });
  for (let i = 0; i < roster.length; i++) {
    const [firstName, lastName, title, dept, loc, manager] = roster[i];
    await db.employee.upsert({
      where: {
        organizationId_employeeNumber: {
          organizationId: orgId,
          employeeNumber: `EMP-${String(i + 1).padStart(4, '0')}`,
        },
      },
      update: {},
      create: {
        id: `demo_emp_${i}`,
        organizationId: orgId,
        employeeNumber: `EMP-${String(i + 1).padStart(4, '0')}`,
        firstName,
        lastName,
        title,
        departmentId: `demo_dept_${dept}`,
        locationId: `demo_loc_${loc}`,
        managerId: manager === null ? null : `demo_emp_${manager}`,
        workEmail:
          i === 0
            ? 'demo@peopleos.app'
            : `${firstName.toLowerCase()}@orbit.demo`,
        status: i >= 15 ? 'ONBOARDING' : 'ACTIVE',
        startDate: date(i >= 15 ? 0 : -18 + i, 1 + i),
        birthDate: new Date(
          Date.UTC(
            1990 + (i % 10),
            now.getUTCMonth(),
            Math.min(28, now.getUTCDate() + (i % 7)),
          ),
        ),
        phone: '+880 1700 000000',
        emergencyName: 'Emergency contact',
        emergencyPhone: '+880 1800 000000',
      },
    });
    for (let p = 0; p < policies.length; p++)
      await db.leaveBalance.upsert({
        where: {
          employeeId_policyId_year: {
            employeeId: `demo_emp_${i}`,
            policyId: `demo_policy_${p}`,
            year,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          employeeId: `demo_emp_${i}`,
          policyId: `demo_policy_${p}`,
          year,
          balanceDays: policies[p][2],
        },
      });
    if (i >= 15)
      for (let t = 0; t < tasks.length; t++)
        await db.onboardingTask.upsert({
          where: { id: `demo_task_${i}_${t}` },
          update: {},
          create: {
            id: `demo_task_${i}_${t}`,
            organizationId: orgId,
            employeeId: `demo_emp_${i}`,
            title: tasks[t],
            sortOrder: t,
            status: t < i - 14 ? 'DONE' : 'TODO',
            dueDate: date(1, 5 + t),
          },
        });
  }
  for (const [i, role] of [
    [0, 'OWNER'],
    [1, 'MANAGER'],
    [2, 'EMPLOYEE'],
    [3, 'RECRUITER'],
  ]) {
    const email =
      i === 0
        ? 'demo@peopleos.app'
        : `${roster[i][0].toLowerCase()}@orbit.demo`;
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        id: `demo_user_${i}`,
        email,
        name: `${roster[i][0]} ${roster[i][1]}`,
        passwordHash,
      },
    });
    const member = await db.membership.upsert({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.id },
      },
      update: {},
      create: {
        id: `demo_member_${i}`,
        organizationId: orgId,
        userId: user.id,
        role,
      },
    });
    await db.employee.update({
      where: { id: `demo_emp_${i}` },
      data: { membershipId: member.id },
    });
  }
  const jobTitles = [
    'Senior Frontend Engineer',
    'Product Designer',
    'Customer Success Manager',
  ];
  for (let i = 0; i < jobTitles.length; i++)
    await db.job.upsert({
      where: { id: `demo_job_${i}` },
      update: {},
      create: {
        id: `demo_job_${i}`,
        organizationId: orgId,
        title: jobTitles[i],
        department: departments[i === 0 ? 0 : i === 1 ? 1 : 4],
        location: i === 0 ? 'Remote' : 'Dhaka',
        hiringManagerId: i === 0 ? 'demo_emp_1' : 'demo_emp_0',
        status: 'OPEN',
        descriptionMd: `## Overview\nJoin Orbit Studio as our ${jobTitles[i]} and help build thoughtful products for growing teams.\n\n## Responsibilities\n- Collaborate with a small, cross-functional team.\n- Own projects from discovery through delivery.\n- Share your knowledge and improve our practices.\n\n## Requirements\n- Three or more years of relevant experience.\n- Clear communication and practical problem solving.\n- ${i === 0 ? 'Strong React, TypeScript, accessible HTML and CSS skills.' : i === 1 ? 'Experience with Figma, user research and interaction design.' : 'Experience supporting B2B software customers.'}\n\n## Benefits\nDiscuss our current benefits with the hiring team.`,
      },
    });
  const candidates = [
    ['Amelia Brooks', 'SCREEN', 0],
    ['Tanvir Ahmed', 'INTERVIEW', 0],
    ['Isabella Rossi', 'OFFER', 1],
    ['Ryan Cooper', 'APPLIED', 0],
    ['Fatima Ali', 'SCREEN', 1],
    ['Leo Mitchell', 'APPLIED', 2],
    ['Chloe Nguyen', 'INTERVIEW', 1],
    ['Adam Khan', 'APPLIED', 2],
    ['Nora Evans', 'REJECTED', 0],
    ['Omar Faruk', 'SCREEN', 2],
    ['Grace Lee', 'APPLIED', 1],
    ['Ben Carter', 'OFFER', 0],
  ];
  for (let i = 0; i < candidates.length; i++)
    await db.candidate.upsert({
      where: { id: `demo_candidate_${i}` },
      update: {},
      create: {
        id: `demo_candidate_${i}`,
        organizationId: orgId,
        jobId: `demo_job_${candidates[i][2]}`,
        name: candidates[i][0],
        email: `candidate${i + 1}@example.test`,
        stage: candidates[i][1],
        resumeText: `${candidates[i][0]}\nExperienced professional with five years of work delivering software products. React, TypeScript, HTML, CSS, accessibility, user research, collaboration, and product strategy. Led a cross-functional team and shipped several production applications.`,
        notes:
          'Demo candidate. Add interview notes and run screening to assess documented skills.',
      },
    });
  // Upcoming weekdays, independent of the day the demo is seeded.
  for (let i = 0; i < 4; i++) {
    const start = new Date(
      Date.UTC(year, now.getUTCMonth(), now.getUTCDate() + 4 + i * 7),
    );
    while ([0, 6].includes(start.getUTCDay()))
      start.setUTCDate(start.getUTCDate() + 1);
    await db.leaveRequest.upsert({
      where: { id: `demo_leave_${i}` },
      update: {},
      create: {
        id: `demo_leave_${i}`,
        organizationId: orgId,
        employeeId: `demo_emp_${i + 2}`,
        policyId: `demo_policy_${i % 3}`,
        startDate: start,
        endDate: start,
        days: 1,
        reason: i % 2 ? 'Personal appointment' : 'A little time to recharge',
        status: 'PENDING',
      },
    });
  }
  const handbook =
    '# Orbit Studio handbook (demo)\n\n## Working together\nOur standard work week is Monday to Friday. Core collaboration hours are 10:00 to 16:00 in your local time zone. Discuss flexible arrangements with your manager.\n\n## Annual leave\nTeam members receive 20 working days of annual leave per calendar year. Request leave in PeopleOS. Your manager or HR must approve requests. Weekends are excluded. Pending requests reserve availability.\n\n## Sick leave\nTeam members receive 10 working days of sick leave per year. Tell your manager as soon as practical and record the request in PeopleOS.\n\n## Personal leave\nFive working days of personal leave are available per calendar year.\n\n## Remote work\nRemote team members may work from their registered location. Ask People Operations before permanently changing your work country.\n\n## Equipment\nWe provide a laptop during onboarding. Report lost or damaged equipment to People Operations.\n\n## Questions\nFor questions not covered here, contact people@orbit.demo. This is an illustrative demo handbook, not legal advice.';
  const existing = await db.document.findUnique({
    where: { id: 'demo_handbook' },
  });
  if (!existing) {
    const key = `${randomUUID()}.bin`;
    const directory = resolve(process.env.UPLOAD_DIR ?? './uploads');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, key), handbook, { mode: 0o600 });
    await db.document.create({
      data: {
        id: 'demo_handbook',
        organizationId: orgId,
        title: 'The Orbit employee handbook',
        category: 'policy',
        fileUrl: key,
        mimeType: 'text/plain',
        size: Buffer.byteLength(handbook),
        contentText: handbook,
        isHandbook: true,
        ingestStatus: 'PENDING',
      },
    });
  }
  for (let i = 0; i < 3; i++)
    await db.goal.upsert({
      where: { id: `demo_goal_${i}` },
      update: {},
      create: {
        id: `demo_goal_${i}`,
        organizationId: orgId,
        employeeId: `demo_emp_${i + 1}`,
        title: [
          'Improve platform reliability',
          'Launch the refreshed design system',
          'Build a thoughtful candidate experience',
        ][i],
        progress: [65, 40, 80][i],
        dueDate: date(2, 1),
      },
    });
  await db.auditLog.upsert({
    where: { id: 'demo_audit' },
    update: {},
    create: {
      id: 'demo_audit',
      organizationId: orgId,
      actorUserId: 'demo_user_0',
      action: 'workspace.demo_seeded',
      entityType: 'Organization',
      entityId: orgId,
    },
  });
  console.log(
    'Orbit Studio demo ready: 18 employees, 3 roles, 12 candidates. Sign in with demo@peopleos.app and your DEMO_PASSWORD.',
  );
} finally {
  await db.$disconnect();
}
