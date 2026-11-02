'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Check, CheckCheck, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { Employee, Task } from '@/lib/types';
import { cn, dateLabel, fullName, label } from '@/lib/utils';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  Progress,
  Tabs,
} from '@/components/ui/core';

export function Onboarding() {
  const people = useApi<Employee[]>('/onboarding');
  const { data: session } = useSession();
  const [tab, setTab] = useState('progress');
  const filtered =
    people.data?.filter((person) => {
      const tasks = person.onboardingTasks ?? [];
      const complete = tasks.length > 0 && tasks.every((task) => task.status === 'DONE');
      return tab === 'complete' ? complete : !complete;
    }) ?? [];
  return (
    <>
      <PageHeader
        title="Great beginnings start here."
        description="A thoughtful first day. A clear path to feeling at home."
        action={
          session?.employeeId && (
            <Link className="btn btn-secondary" href={`/app/onboarding/${session.employeeId}`}>
              <CheckCheck size={17} />
              My checklist
            </Link>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'progress', label: 'Settling in' },
          { value: 'complete', label: 'Ready to thrive' },
        ]}
      />
      {people.isPending ? (
        <Loading />
      ) : people.error ? (
        <ErrorState error={people.error} retry={() => void people.refetch()} />
      ) : filtered.length ? (
        <div className="onboarding-grid">
          {filtered.map((person) => {
            const tasks = person.onboardingTasks ?? [];
            const done = tasks.filter((task) => task.status === 'DONE').length;
            const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
            return (
              <Panel className="onboarding-card" key={person.id}>
                <div className="between">
                  <Avatar name={fullName(person)} size="lg" />
                  <Badge value={progress === 100 ? 'DONE' : 'ONBOARDING'}>
                    {progress === 100 ? 'Ready to thrive' : 'Settling in'}
                  </Badge>
                </div>
                <h3>{fullName(person)}</h3>
                <p>{person.title ?? 'Our newest teammate'}</p>
                <div className="row muted" style={{ marginTop: 13, gap: 6 }}>
                  <CalendarDays size={15} />
                  Starts {dateLabel(person.startDate, 'MMM d, yyyy')}
                </div>
                <Progress value={progress} label={`${fullName(person)} onboarding progress`} />
                <div className="between">
                  <span>
                    {done} of {tasks.length} steps
                  </span>
                  <strong>{progress}%</strong>
                </div>
                <Link href={`/app/onboarding/${person.id}`} className="text-link">
                  Open checklist <ArrowRight size={16} />
                </Link>
              </Panel>
            );
          })}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title={
              tab === 'complete'
                ? 'Good beginnings take a little time.'
                : 'Everyone’s finding their feet.'
            }
            description={
              tab === 'complete'
                ? 'Completed onboarding checklists will appear here.'
                : 'Add a teammate or hire a candidate to start their onboarding.'
            }
            icon={<Sparkles size={27} />}
          />
        </Panel>
      )}
    </>
  );
}
export function OnboardingChecklist({ id }: { id: string }) {
  const people = useApi<Employee[]>(`/onboarding/${id}`);
  const update = useAction(
    async ({ taskId, status }: { taskId: string; status: Task['status'] }) =>
      (await api.patch(`/onboarding/${id}`, { taskId, status })).data,
    { success: 'Checklist updated. One step closer.' },
  );
  if (people.isPending) return <Loading />;
  if (people.error) return <ErrorState error={people.error} retry={() => void people.refetch()} />;
  const person = people.data[0];
  if (!person) return <EmptyState title="We couldn’t find this teammate." />;
  const tasks = person.onboardingTasks ?? [];
  const done = tasks.filter((task) => task.status === 'DONE').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <>
      <PageHeader
        title={`A warm welcome, ${person.firstName}.`}
        description="A few small steps toward feeling right at home."
        back="/app/onboarding"
        action={
          <Link className="btn btn-secondary" href={`/app/directory/${id}`}>
            View profile <ArrowRight size={16} />
          </Link>
        }
      />
      <Panel>
        <div className="panel-heading">
          <div className="person-cell">
            <Avatar name={fullName(person)} size="lg" />
            <span>
              <strong>{fullName(person)}</strong>
              <small>
                {person.title} · {person.department?.name ?? 'Our team'}
              </small>
            </span>
          </div>
          <Badge value={person.status} />
        </div>
        <div className="panel-body">
          <div className="between" style={{ marginBottom: 10 }}>
            <span className="muted">
              {done} of {tasks.length} steps complete
            </span>
            <strong>{progress}%</strong>
          </div>
          <Progress value={progress} label="Onboarding completion" />
        </div>
        {progress === 100 && (
          <div className="notice" style={{ margin: '0 24px 22px' }}>
            <CheckCheck size={20} />
            <span>All set. Here’s to a great next chapter.</span>
          </div>
        )}
        <div className="panel-body">
          {tasks.length ? (
            tasks.map((task) => (
              <div className={cn('checklist-task', task.status === 'DONE' && 'done')} key={task.id}>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  className={cn('task-check', task.status === 'DONE' && 'done')}
                  aria-label={`${task.status === 'DONE' ? 'Mark incomplete' : 'Complete'}: ${task.title}`}
                  aria-pressed={task.status === 'DONE'}
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      taskId: task.id,
                      status: task.status === 'DONE' ? 'TODO' : 'DONE',
                    })
                  }
                >
                  {task.status === 'DONE' && (
                    <motion.span
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check size={14} />
                    </motion.span>
                  )}
                </motion.button>
                <div>
                  <strong>{task.title}</strong>
                  <p>
                    {task.dueDate
                      ? `Aim for ${dateLabel(task.dueDate)}`
                      : 'Coordinate this step with your team, then mark it complete.'}
                  </p>
                </div>
                <select
                  value={task.status}
                  aria-label={`Status for ${task.title}`}
                  disabled={update.isPending}
                  onChange={(event) =>
                    update.mutate({ taskId: task.id, status: event.target.value as Task['status'] })
                  }
                >
                  {['TODO', 'DOING', 'DONE', 'BLOCKED'].map((status) => (
                    <option value={status} key={status}>
                      {label(status)}
                    </option>
                  ))}
                </select>
              </div>
            ))
          ) : (
            <EmptyState
              title="No checklist for this employee."
              description="Checklists are created automatically for newly added and hired teammates."
            />
          )}
        </div>
      </Panel>
    </>
  );
}
