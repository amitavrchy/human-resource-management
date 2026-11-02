'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, BriefcaseBusiness, MapPin, Plus, Search, Users } from 'lucide-react';
import { useApi, useSession } from '@/hooks/use-api';
import type { Job } from '@/lib/types';
import { canRecruit } from '@/lib/utils';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  Tabs,
} from '@/components/ui/core';
import { JobDialog } from './job-form';

export function Jobs() {
  const jobs = useApi<Job[]>('/jobs');
  const { data: session } = useSession();
  const [status, setStatus] = useState('OPEN');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const filtered =
    jobs.data?.filter(
      (job) =>
        (!status || job.status === status) &&
        `${job.title} ${job.department ?? ''} ${job.location ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? [];
  const close = (open: boolean) => {
    setAdding(open);
    if (!open && params.has('create')) router.replace('/app/recruiting/jobs', { scroll: false });
  };
  return (
    <>
      <PageHeader
        title="The next chapter of your team."
        description="Find good people. Give them a great first impression."
        action={
          canRecruit(session?.role) && (
            <Button onClick={() => setAdding(true)}>
              <Plus size={17} />
              Create role
            </Button>
          )
        }
      />
      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          {
            value: 'OPEN',
            label: 'Open roles',
            count: jobs.data?.filter((job) => job.status === 'OPEN').length,
          },
          { value: 'DRAFT', label: 'Drafts' },
          { value: 'CLOSED', label: 'Closed' },
          { value: '', label: 'All roles' },
        ]}
      />
      <div className="toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search roles"
            placeholder="Search roles, teams or locations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="muted">
          {filtered.length} {filtered.length === 1 ? 'role' : 'roles'}
        </span>
      </div>
      {jobs.isPending ? (
        <Loading />
      ) : jobs.error ? (
        <ErrorState error={jobs.error} retry={() => void jobs.refetch()} />
      ) : filtered.length ? (
        <div className="jobs-grid">
          {filtered.map((job) => (
            <Link href={`/app/recruiting/jobs/${job.id}`} key={job.id} className="panel job-card">
              <div className="between">
                <span className="job-icon">
                  <BriefcaseBusiness size={23} strokeWidth={1.6} />
                </span>
                <Badge value={job.status} />
              </div>
              <h3>{job.title}</h3>
              <div className="job-tags">
                <span>
                  <Users size={14} />
                  {job.department || 'Unassigned'}
                </span>
                <span>
                  <MapPin size={14} />
                  {job.location || 'Flexible'}
                </span>
              </div>
              <div className="job-card-footer">
                <span>{job._count?.candidates ?? 0} candidates</span>
                <span className="text-link">
                  View pipeline <ArrowUpRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title="Someone great is out there."
            description="Create a role to start building your next chapter."
            icon={<BriefcaseBusiness size={26} />}
            action={
              canRecruit(session?.role) && (
                <Button onClick={() => setAdding(true)}>
                  <Plus size={16} />
                  Create role
                </Button>
              )
            }
          />
        </Panel>
      )}
      <JobDialog
        open={canRecruit(session?.role) && (adding || params.get('create') === '1')}
        onOpenChange={close}
      />
    </>
  );
}
