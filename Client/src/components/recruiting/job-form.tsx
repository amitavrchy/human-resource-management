'use client';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import type { Employee, Job, Metadata, JobTemplate } from '@/lib/types';
import { fullName, isAdmin } from '@/lib/utils';
import { Button, Field, Modal } from '@/components/ui/core';
import { JdGenerator } from '@/components/ai/jd-generator';

interface Values {
  title: string;
  department: string;
  location: string;
  descriptionMd: string;
  status: string;
  hiringManagerId: string;
}
export function JobDialog({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  job?: Job;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={job ? 'Keep the role in focus.' : 'Your next great teammate starts here.'}
      description="Give this role a clear title, a thoughtful description and a place in your team."
    >
      <JobForm job={job} close={() => onOpenChange(false)} />
    </Modal>
  );
}
function JobForm({ job, close }: { job?: Job; close: () => void }) {
  const { data: session } = useSession();
  const templates = useApi<JobTemplate[]>('/job-templates');
  const people = useApi<Employee[]>('/employees/org-tree', isAdmin(session?.role));
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      title: job?.title ?? '',
      department: job?.department ?? '',
      location: job?.location ?? '',
      descriptionMd: job?.descriptionMd ?? '',
      status: job?.status ?? 'OPEN',
      hiringManagerId: job?.hiringManagerId ?? '',
    },
  });
  const hiringManagerId = useWatch({ control, name: 'hiringManagerId' });
  const title = useWatch({ control, name: 'title' });
  const department = useWatch({ control, name: 'department' });
  const [generating, setGenerating] = useState(false);
  const save = useAction(
    async (values: Values) =>
      (await (job ? api.patch(`/jobs/${job.id}`, values) : api.post('/jobs', values))).data,
    { success: job ? 'Role updated.' : 'A new role. A new possibility.', onSuccess: close },
  );
  return (
    <>
      <form onSubmit={handleSubmit((values) => save.mutate(values))}>
        <div className="form-grid">
          {!job && !!templates.data?.length && (
            <Field label="Start from a template" className="full">
              <select
                defaultValue=""
                onChange={(event) => {
                  const template = templates.data?.find((item) => item.id === event.target.value);
                  if (template) {
                    setValue('title', template.title);
                    setValue('department', template.department);
                    setValue('descriptionMd', template.descriptionMd, { shouldValidate: true });
                  }
                }}
              >
                <option value="">Write from scratch</option>
                {templates.data.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Job title" className="full" error={errors.title?.message}>
            <input
              placeholder="Senior Frontend Engineer"
              maxLength={160}
              {...register('title', { required: 'Give this role a title.', minLength: 2 })}
            />
          </Field>
          <Field label="Department">
            <input maxLength={120} placeholder="Engineering" {...register('department')} />
          </Field>
          <Field label="Location">
            <input maxLength={120} placeholder="Dhaka / Remote" {...register('location')} />
          </Field>
          <Field label="Status">
            <select {...register('status')}>
              <option value="OPEN">Open for hiring</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
          {isAdmin(session?.role) && (
            <Field label="Hiring manager">
              <select value={hiringManagerId} {...register('hiringManagerId')}>
                <option value="">Not assigned</option>
                {people.data?.map((person) => (
                  <option value={person.id} key={person.id}>
                    {fullName(person)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="field full">
            <div className="between">
              <label htmlFor="job-description">Job description</label>
              <Button type="button" variant="ghost" onClick={() => setGenerating(true)}>
                <Sparkles size={16} />
                Write with AI
              </Button>
            </div>
            <textarea
              id="job-description"
              rows={10}
              maxLength={30000}
              placeholder="What will this person work on? What do they need to succeed?"
              {...register('descriptionMd', {
                required: 'Add a job description.',
                minLength: { value: 20, message: 'Add at least 20 characters.' },
              })}
            />
            {errors.descriptionMd && (
              <span className="field-error">{errors.descriptionMd.message}</span>
            )}
            <span className="field-hint">
              Markdown is welcome. Clear, inclusive language is always a good start.
            </span>
          </div>
        </div>
        <div className="dialog-footer">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {job ? 'Save role' : 'Create role'}
          </Button>
        </div>
      </form>
      <Modal
        open={generating}
        onOpenChange={setGenerating}
        title="A thoughtful first draft."
        description="Tell your copilot what this role needs."
        wide
      >
        <JdGenerator
          initialTitle={title}
          initialDepartment={department}
          onUse={(markdown) => {
            setValue('descriptionMd', markdown, { shouldValidate: true });
            setGenerating(false);
          }}
        />
      </Modal>
    </>
  );
}
export function HireDialog({
  candidate,
  job,
  onClose,
}: {
  candidate: { id: string; name: string } | null;
  job?: Job;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!candidate}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={
        candidate ? `Welcome ${candidate.name.split(' ')[0]} to the team.` : 'Welcome to the team.'
      }
      description="Hiring creates one employee record, annual leave balances and an onboarding checklist."
    >
      {candidate && <HireForm candidate={candidate} job={job} close={onClose} />}
    </Modal>
  );
}
function HireForm({
  candidate,
  job,
  close,
}: {
  candidate: { id: string; name: string };
  job?: Job;
  close: () => void;
}) {
  const meta = useApi<Metadata>('/organization/metadata');
  const { register, handleSubmit } = useForm<{
    startDate: string;
    departmentId: string;
    locationId: string;
    managerId: string;
  }>({
    defaultValues: {
      startDate: new Date().toISOString().slice(0, 10),
      departmentId: '',
      locationId: '',
      managerId: job?.hiringManagerId ?? '',
    },
  });
  const hire = useAction(
    async (values: {
      startDate: string;
      departmentId: string;
      locationId: string;
      managerId: string;
    }) =>
      (
        await api.post(
          `/candidates/${candidate.id}/hire`,
          Object.fromEntries(Object.entries(values).filter(([, value]) => value)),
        )
      ).data,
    { success: 'It’s official. Their onboarding checklist is ready.', onSuccess: close },
  );
  return (
    <form onSubmit={handleSubmit((values) => hire.mutate(values))}>
      <div className="stack-sm">
        <Field label="First day">
          <input type="date" required {...register('startDate', { required: true })} />
        </Field>
        <Field label="Department">
          <select {...register('departmentId')}>
            <option value="">Unassigned</option>
            {meta.data?.departments.map((dept) => (
              <option value={dept.id} key={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <select {...register('locationId')}>
            <option value="">Unassigned</option>
            {meta.data?.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>
        <p className="field-hint">
          The employee starts in Onboarding status and becomes Active when their checklist is
          complete.
        </p>
      </div>
      <div className="dialog-footer">
        <Button type="button" variant="secondary" onClick={close}>
          Go back
        </Button>
        <Button type="submit" loading={hire.isPending}>
          Confirm hire
        </Button>
      </div>
    </form>
  );
}
