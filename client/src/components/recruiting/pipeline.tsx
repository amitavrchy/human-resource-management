'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Candidate, Job, Stage } from '@/lib/types';
import { canRecruit, cn, dateLabel, label } from '@/lib/utils';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Panel,
  Tabs,
} from '@/components/ui/core';
import { HireDialog, JobDialog } from './job-form';
import { useRouter } from 'next/navigation';

export const stages: Stage[] = ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];
function CandidateForm({ jobId, close }: { jobId: string; close: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string; email: string; resumeText: string; notes: string }>();
  const add = useAction(
    async (values: { name: string; email: string; resumeText: string; notes: string }) =>
      (await api.post(`/jobs/${jobId}/candidates`, values)).data,
    { success: 'A new introduction. Candidate added.', onSuccess: close },
  );
  return (
    <form onSubmit={handleSubmit((values) => add.mutate(values))}>
      <div className="stack-sm">
        <Field label="Full name" error={errors.name?.message}>
          <input
            maxLength={120}
            {...register('name', { required: 'Enter a name.', minLength: 2 })}
          />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" {...register('email', { required: 'Enter an email address.' })} />
        </Field>
        <Field
          label="Resume text"
          hint="Optional. You can upload a PDF from the candidate profile."
        >
          <textarea
            rows={6}
            maxLength={60000}
            placeholder="Paste the candidate’s resume here…"
            {...register('resumeText')}
          />
        </Field>
        <Field label="First impressions">
          <textarea rows={2} maxLength={10000} {...register('notes')} />
        </Field>
      </div>
      <div className="dialog-footer">
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={add.isPending}>
          Add candidate
        </Button>
      </div>
    </form>
  );
}
export function JobPipeline({ id }: { id: string }) {
  const job = useApi<Job>(`/jobs/${id}`);
  const { data: session } = useSession();
  const [tab, setTab] = useState('pipeline');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hiring, setHiring] = useState<Candidate | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const write = canRecruit(session?.role);
  const move = useAction(
    async ({ candidateId, stage }: { candidateId: string; stage: Stage }) =>
      (await api.patch(`/candidates/${candidateId}/stage`, { stage })).data,
    { success: 'Pipeline updated.' },
  );
  const remove = useAction(async () => (await api.delete(`/jobs/${id}`)).data, {
    success: 'Role deleted.',
    onSuccess: () => router.push('/app/recruiting/jobs'),
  });
  if (job.isPending) return <Loading />;
  if (job.error) return <ErrorState error={job.error} retry={() => void job.refetch()} />;
  const data = job.data;
  const candidates =
    data.candidates?.filter((candidate) =>
      `${candidate.name} ${candidate.email}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const drop = (candidateId: string, stage: Stage) => {
    const candidate = data.candidates?.find((person) => person.id === candidateId);
    if (!candidate || candidate.stage === stage || candidate.stage === 'HIRED') return;
    if (stage === 'HIRED') {
      if (candidate.stage === 'OFFER') setHiring(candidate);
      else toast.info('Move the candidate to Offer before confirming their hire.');
    } else move.mutate({ candidateId, stage });
  };
  return (
    <>
      <PageHeader
        title={data.title}
        back="/app/recruiting/jobs"
        description={`${data.department || 'Team'} · ${data.location || 'Flexible location'} · ${data.candidates?.length ?? 0} candidates`}
        action={
          <>
            <Badge value={data.status} />
            {write && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil size={16} />
                Edit role
              </Button>
            )}
            {write && data.status === 'OPEN' && (
              <Button onClick={() => setAdding(true)}>
                <Plus size={17} />
                Add candidate
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pipeline', label: 'Hiring pipeline', count: data.candidates?.length },
          { value: 'description', label: 'Job description' },
        ]}
      />
      {tab === 'description' ? (
        <Panel>
          <div className="profile-details">
            <div className="prose">{data.descriptionMd}</div>
            {write && !data.candidates?.length && (
              <Button
                variant="ghost"
                style={{ marginTop: 20, color: '#c35b50' }}
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={16} />
                Delete role
              </Button>
            )}
          </div>
        </Panel>
      ) : (
        <>
          <div className="toolbar">
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Search candidates"
                placeholder="Search candidates…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <span className="muted">
              {write
                ? 'Drag to move stages, or open a candidate to make a change.'
                : 'Your hiring team’s pipeline.'}
            </span>
          </div>
          <div className="pipeline" aria-label="Candidate hiring pipeline">
            {stages.map((stage) => {
              const people = candidates.filter((candidate) => candidate.stage === stage);
              return (
                <section
                  className={cn('pipeline-column', dragOver === stage && 'drag-over')}
                  key={stage}
                  onDragOver={(event) => {
                    if (write && !move.isPending) {
                      event.preventDefault();
                      setDragOver(stage);
                    }
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(null);
                    if (write && !move.isPending)
                      drop(event.dataTransfer.getData('text/plain'), stage);
                  }}
                  aria-label={`${label(stage)} candidates`}
                >
                  <div className="pipeline-column-heading">
                    <span>
                      <span className={`stage-dot stage-${stage.toLowerCase()}`} />
                      {label(stage)}
                      <small>{people.length}</small>
                    </span>
                    {stage === 'APPLIED' && write && data.status === 'OPEN' && (
                      <button
                        className="icon-button"
                        aria-label="Add candidate"
                        onClick={() => setAdding(true)}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                  {people.map((candidate) => (
                    <article
                      className="candidate-card"
                      key={candidate.id}
                      draggable={write && candidate.stage !== 'HIRED' && !move.isPending}
                      onDragStart={(event) =>
                        event.dataTransfer.setData('text/plain', candidate.id)
                      }
                    >
                      <div className="between">
                        <Avatar name={candidate.name} size="sm" />
                        {candidate.aiScore !== null && (
                          <span
                            className="score"
                            title="AI skill relevance score, for human review"
                          >
                            <Sparkles size={13} />
                            {candidate.aiScore}
                          </span>
                        )}
                      </div>
                      <Link href={`/app/recruiting/candidates/${candidate.id}`}>
                        <h3>{candidate.name}</h3>
                        <p>{candidate.email}</p>
                      </Link>
                      <div className="candidate-card-footer">
                        <span>{dateLabel(candidate.createdAt, 'MMM d')}</span>
                        <Link
                          className="text-link"
                          href={`/app/recruiting/candidates/${candidate.id}`}
                        >
                          Open
                        </Link>
                      </div>
                    </article>
                  ))}
                  {!people.length && (
                    <p className="muted" style={{ textAlign: 'center', padding: '24px 8px' }}>
                      {search ? 'No matching candidates' : 'A little room for possibility.'}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
      <Modal
        open={adding}
        onOpenChange={setAdding}
        title="A new introduction."
        description={`Add a candidate for ${data.title}.`}
      >
        <CandidateForm jobId={id} close={() => setAdding(false)} />
      </Modal>
      <JobDialog open={editing} onOpenChange={setEditing} job={data} />
      <HireDialog candidate={hiring} job={data} onClose={() => setHiring(null)} />
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this role?"
        description="This empty role will be permanently removed."
      >
        <div className="dialog-footer">
          <Button variant="secondary" onClick={() => setDeleting(false)}>
            Keep role
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
            Delete role
          </Button>
        </div>
      </Modal>
    </>
  );
}
