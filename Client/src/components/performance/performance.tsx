'use client';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CalendarDays, MessageSquare, Plus, Star, Target } from 'lucide-react';
import { api } from '@/lib/api';
import type { Employee, Goal, Review } from '@/lib/types';
import { dateLabel, fullName } from '@/lib/utils';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Panel,
  Progress,
  Tabs,
} from '@/components/ui/core';

function GoalForm({ close }: { close: () => void }) {
  const { data: session } = useSession();
  const people = useApi<Employee[]>('/employees/org-tree');
  const { register, control, handleSubmit } = useForm<{
    employeeId: string;
    title: string;
    dueDate: string;
  }>({ defaultValues: { employeeId: session?.employeeId ?? '', title: '', dueDate: '' } });
  const employeeId = useWatch({ control, name: 'employeeId' });
  const save = useAction(
    async (values: { employeeId: string; title: string; dueDate: string }) =>
      (await api.post('/goals', { ...values, dueDate: values.dueDate || undefined })).data,
    { success: 'A little direction goes a long way. Goal created.', onSuccess: close },
  );
  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))}>
      <div className="stack-sm">
        <Field label="Whose goal?">
          <select required value={employeeId} {...register('employeeId', { required: true })}>
            <option value="">Choose a teammate</option>
            {people.data?.map((person) => (
              <option value={person.id} key={person.id}>
                {fullName(person)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What does success look like?">
          <input
            required
            minLength={3}
            maxLength={200}
            placeholder="Launch the new design system"
            {...register('title', { required: true, minLength: 3 })}
          />
        </Field>
        <Field label="Aim for">
          <input type="date" {...register('dueDate')} />
        </Field>
      </div>
      <div className="dialog-footer">
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Create goal
        </Button>
      </div>
    </form>
  );
}
function ReviewForm({ close }: { close: () => void }) {
  const { data: session } = useSession();
  const people = useApi<Employee[]>('/employees/org-tree');
  const date = new Date();
  const { register, control, handleSubmit } = useForm<{
    employeeId: string;
    quarter: string;
    achievements: string;
    improvements: string;
    rating: string;
  }>({
    defaultValues: {
      employeeId: session?.employeeId ?? '',
      quarter: `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`,
      achievements: '',
      improvements: '',
      rating: '3',
    },
  });
  const employeeId = useWatch({ control, name: 'employeeId' });
  const save = useAction(
    async (values: {
      employeeId: string;
      quarter: string;
      achievements: string;
      improvements: string;
      rating: string;
    }) => (await api.post('/reviews', { ...values, rating: Number(values.rating) })).data,
    { success: 'Reflection saved. Here’s to the next chapter.', onSuccess: close },
  );
  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))}>
      <div className="stack-sm">
        <div className="form-grid">
          <Field label="Team member">
            <select required value={employeeId} {...register('employeeId', { required: true })}>
              <option value="">Choose a teammate</option>
              {people.data?.map((person) => (
                <option value={person.id} key={person.id}>
                  {fullName(person)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quarter" hint="For example: 2026-Q4">
            <input
              required
              pattern="[0-9]{4}-Q[1-4]"
              {...register('quarter', { required: true })}
            />
          </Field>
        </div>
        <Field label="What went well?">
          <textarea
            required
            minLength={5}
            maxLength={5000}
            rows={4}
            {...register('achievements', { required: true, minLength: 5 })}
          />
        </Field>
        <Field label="Where is there room to grow?">
          <textarea
            required
            minLength={5}
            maxLength={5000}
            rows={4}
            {...register('improvements', { required: true, minLength: 5 })}
          />
        </Field>
        <Field label="Overall reflection">
          <select {...register('rating')}>
            <option value="1">1 · Needs significant support</option>
            <option value="2">2 · Developing</option>
            <option value="3">3 · Meeting expectations</option>
            <option value="4">4 · Exceeding expectations</option>
            <option value="5">5 · Exceptional contribution</option>
          </select>
        </Field>
        <p className="field-hint">
          This quarterly reflection is visible to the employee, their reporting managers and HR.
        </p>
      </div>
      <div className="dialog-footer">
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Save reflection
        </Button>
      </div>
    </form>
  );
}
function ProgressForm({ goal, close }: { goal: Goal; close: () => void }) {
  const { register, control, handleSubmit } = useForm<{ progress: number }>({
    defaultValues: { progress: goal.progress },
  });
  const save = useAction(
    async (value: { progress: number }) =>
      (await api.patch(`/goals/${goal.id}`, { progress: Number(value.progress) })).data,
    { success: 'Progress, a little more visible.', onSuccess: close },
  );
  const progress = useWatch({ control, name: 'progress' });
  return (
    <form onSubmit={handleSubmit((value) => save.mutate(value))}>
      <Field label={`Progress · ${progress}%`}>
        <input type="range" min={0} max={100} step={5} {...register('progress')} />
      </Field>
      <div className="dialog-footer">
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          Save progress
        </Button>
      </div>
    </form>
  );
}
export function Performance() {
  const performance = useApi<{ goals: Goal[]; reviews: Review[] }>('/performance');
  const [tab, setTab] = useState('goals');
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  return (
    <>
      <PageHeader
        title="Small steps. Meaningful growth."
        description="Clear goals and thoughtful reflections for the people behind the work."
        action={
          <>
            <Button variant="secondary" onClick={() => setReviewing(true)}>
              <MessageSquare size={16} />
              Quarterly reflection
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus size={17} />
              Set a goal
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'goals', label: 'Goals', count: performance.data?.goals.length },
          {
            value: 'reviews',
            label: 'Quarterly reflections',
            count: performance.data?.reviews.length,
          },
        ]}
      />
      {performance.isPending ? (
        <Loading />
      ) : performance.error ? (
        <ErrorState error={performance.error} retry={() => void performance.refetch()} />
      ) : tab === 'goals' ? (
        performance.data.goals.length ? (
          <div className="goal-grid">
            {performance.data.goals.map((goal) => (
              <Panel key={goal.id} className="goal-card">
                <div className="person-cell">
                  <Avatar name={fullName(goal.employee)} size="sm" />
                  <span>
                    <strong>{fullName(goal.employee)}</strong>
                  </span>
                </div>
                <h3>{goal.title}</h3>
                <span className="row muted" style={{ gap: 6 }}>
                  <CalendarDays size={15} />
                  {goal.dueDate
                    ? `Aim for ${dateLabel(goal.dueDate)}`
                    : 'A little progress, every day'}
                </span>
                <Progress value={goal.progress} label={`${goal.title} progress`} />
                <div className="between">
                  <span>{goal.progress}% complete</span>
                  <Button variant="ghost" onClick={() => setEditing(goal)}>
                    Update progress
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <Panel>
            <EmptyState
              title="Give growth a little direction."
              description="Create a clear, achievable goal to get started."
              icon={<Target size={27} />}
              action={
                <Button onClick={() => setAdding(true)}>
                  <Plus size={16} />
                  Set a goal
                </Button>
              }
            />
          </Panel>
        )
      ) : performance.data.reviews.length ? (
        <div className="goal-grid">
          {performance.data.reviews.map((review) => (
            <Panel className="review-card" key={review.id}>
              <div className="between">
                <div className="person-cell">
                  <Avatar name={fullName(review.employee)} size="sm" />
                  <span>
                    <strong>{fullName(review.employee)}</strong>
                    <small>{review.quarter}</small>
                  </span>
                </div>
                <span className="row" style={{ color: '#b78e46', gap: 5 }}>
                  <Star size={16} />
                  {review.rating}/5
                </span>
              </div>
              <h4>What went well</h4>
              <p>{review.achievements}</p>
              <h4>Room to grow</h4>
              <p>{review.improvements}</p>
              <p style={{ marginTop: 18 }}>{dateLabel(review.createdAt)}</p>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title="A moment to reflect."
            description="Capture what went well and what comes next."
            icon={<MessageSquare size={27} />}
            action={<Button onClick={() => setReviewing(true)}>Start a reflection</Button>}
          />
        </Panel>
      )}
      <Modal
        open={adding}
        onOpenChange={setAdding}
        title="A little direction. A lot of possibility."
        description="Set a goal that gives your teammate something meaningful to work toward."
      >
        <GoalForm close={() => setAdding(false)} />
      </Modal>
      <Modal
        open={reviewing}
        onOpenChange={setReviewing}
        title="A moment to look back."
        description="A simple quarterly reflection. Specific, thoughtful and constructive."
        wide
      >
        <ReviewForm close={() => setReviewing(false)} />
      </Modal>
      <Modal
        open={!!editing}
        onOpenChange={() => setEditing(null)}
        title="One step closer."
        description={editing?.title}
      >
        {editing && <ProgressForm goal={editing} close={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
