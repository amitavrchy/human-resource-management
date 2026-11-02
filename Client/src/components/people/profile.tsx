'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  Download,
  MapPin,
  Pencil,
  ShieldCheck,
  UserRound,
  Archive,
} from 'lucide-react';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import { api } from '@/lib/api';
import type { Employee } from '@/lib/types';
import { dateLabel, fullName, isAdmin } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  Panel,
  PanelHeader,
  Progress,
  Tabs,
} from '@/components/ui/core';
import { EmployeeDialog } from './employee-form';

export function EmployeeProfile({ id }: { id: string }) {
  const profile = useApi<Employee>(`/employees/${id}`);
  const { data: session } = useSession();
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const archive = useAction(async () => (await api.delete(`/employees/${id}`)).data, {
    success: 'Employee archived. Their history is preserved.',
    onSuccess: () => setArchiving(false),
  });
  if (profile.isPending) return <Loading label="Getting to know your teammate…" />;
  if (profile.error)
    return <ErrorState error={profile.error} retry={() => void profile.refetch()} />;
  const person = profile.data;
  const tasks = person.tasks ?? [];
  const progress = tasks.length
    ? Math.round((tasks.filter((t) => t.status === 'DONE').length / tasks.length) * 100)
    : 0;
  const admin = isAdmin(session?.role);
  return (
    <>
      <Link className="back-link" href="/app/directory">
        <ArrowLeft size={16} />
        Back to people
      </Link>
      <Panel>
        <div className="profile-cover" />
        <div className="profile-heading">
          <Avatar name={fullName(person)} size="xl" />
          <div>
            <h1>{fullName(person)}</h1>
            <p>
              {person.title ?? 'Team member'} · {person.department?.name ?? 'Unassigned department'}
            </p>
            <div className="profile-meta">
              <Badge value={person.status} />
              <span>
                <MapPin size={14} />
                {person.location?.name ?? 'No location'}
              </span>
              <span>
                <CalendarDays size={14} />
                Joined {dateLabel(person.startDate, 'MMM yyyy')}
              </span>
            </div>
          </div>
          {(admin || session?.employeeId === id) && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              Edit profile
            </Button>
          )}
        </div>
        <div className="profile-tabs">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview' },
              ...(person.privateAccess
                ? [
                    { value: 'personal', label: 'Personal details' },
                    {
                      value: 'documents',
                      label: 'Documents',
                      count: person.documents?.length ?? 0,
                    },
                  ]
                : []),
              { value: 'leave', label: 'Time off' },
              { value: 'equipment', label: 'Onboarding & equipment' },
            ]}
          />
        </div>
      </Panel>
      <div className="profile-grid">
        <div className="stack">
          {tab === 'overview' && (
            <Panel>
              <PanelHeader
                title="At work"
                description="The details that keep everyone connected."
              />
              <div className="profile-details">
                <div className="info-grid">
                  {[
                    [
                      'Work email',
                      <a key="mail" href={`mailto:${person.workEmail}`} className="text-link">
                        {person.workEmail}
                      </a>,
                    ],
                    [
                      'Employee number',
                      <span className="mono" key="id">
                        {person.employeeNumber}
                      </span>,
                    ],
                    ['Department', person.department?.name ?? 'Unassigned'],
                    ['Job title', person.title ?? '—'],
                    [
                      'Location',
                      person.location
                        ? `${person.location.name} · ${person.location.country}`
                        : 'Unassigned',
                    ],
                    ['Start date', dateLabel(person.startDate)],
                  ].map(([key, value]) => (
                    <div className="info-item" key={String(key)}>
                      <span>{key}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
          {tab === 'personal' && person.privateAccess && (
            <Panel>
              <PanelHeader
                title="A little more about them"
                description="Private to the employee and HR administrators."
              />
              <div className="profile-details">
                <div className="info-grid">
                  {[
                    ['Personal email', person.personalEmail],
                    ['Phone number', person.phone],
                    ['Date of birth', dateLabel(person.birthDate)],
                    ['Emergency contact', person.emergencyName],
                    ['Emergency phone', person.emergencyPhone],
                  ].map(([key, value]) => (
                    <div className="info-item" key={key}>
                      <span>{key}</span>
                      <strong>{value || 'Not provided'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
          {tab === 'documents' && (
            <Panel>
              <PanelHeader title="Personal documents" />
              {person.documents?.length ? (
                person.documents.map((doc) => (
                  <div className="settings-list-row" key={doc.id}>
                    <div>
                      <strong>{doc.title}</strong>
                      <p>
                        {doc.category} · {dateLabel(doc.createdAt)}
                      </p>
                    </div>
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="icon-button"
                      aria-label={`Download ${doc.title}`}
                    >
                      <Download size={18} />
                    </a>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Everything in its place."
                  description="Employee files will appear here when HR uploads them."
                />
              )}
            </Panel>
          )}
          {tab === 'leave' && (
            <Panel>
              <PanelHeader title="Time away" description="Recent requests and decisions." />
              {person.leaveHistory?.length ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <caption className="sr-only">Leave history</caption>
                    <thead>
                      <tr>
                        <th scope="col">Policy</th>
                        <th scope="col">Dates</th>
                        <th scope="col">Days</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {person.leaveHistory.map((request) => (
                        <tr key={request.id}>
                          <td>{request.policy.name}</td>
                          <td>
                            {dateLabel(request.startDate, 'MMM d')} –{' '}
                            {dateLabel(request.endDate, 'MMM d')}
                          </td>
                          <td>{request.days}</td>
                          <td>
                            <Badge value={request.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No time-off history yet."
                  description="Leave requests will appear here."
                />
              )}
            </Panel>
          )}
          {tab === 'equipment' && (
            <Panel>
              <PanelHeader
                title="A thoughtful start"
                description="Accounts, equipment and everything for day one."
              />
              {tasks.length ? (
                <div className="panel-body">
                  {tasks.map((task) => (
                    <div className="checklist-task" key={task.id}>
                      <span
                        className={`task-check ${task.status === 'DONE' ? 'done' : ''}`}
                        aria-hidden="true"
                      >
                        {task.status === 'DONE' && <CheckCheck size={15} />}
                      </span>
                      <div>
                        <strong>{task.title}</strong>
                        <p>
                          {task.dueDate
                            ? `Due ${dateLabel(task.dueDate)}`
                            : 'Part of the onboarding checklist'}
                        </p>
                      </div>
                      <Badge value={task.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No checklist yet."
                  description="New teammates receive a checklist when added or hired."
                />
              )}
            </Panel>
          )}
        </div>
        <div className="stack">
          <Panel>
            <PanelHeader title="Their place in the team" />
            <div className="panel-body">
              {person.manager ? (
                <>
                  <p className="muted" style={{ marginBottom: 13 }}>
                    Reports to
                  </p>
                  <Link className="person-cell" href={`/app/directory/${person.manager.id}`}>
                    <Avatar name={fullName(person.manager)} />
                    <span>
                      <strong>{fullName(person.manager)}</strong>
                      <small>{person.manager.title}</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                </>
              ) : (
                <div className="row muted">
                  <UserRound size={19} />
                  No reporting manager
                </div>
              )}
              <Link href="/app/org-chart" className="text-link" style={{ marginTop: 22 }}>
                View organization chart <ArrowUpRight size={15} />
              </Link>
            </div>
          </Panel>
          <Panel>
            <PanelHeader
              title="Settling in"
              action={
                <span className="stat-icon">
                  <CheckCheck size={18} />
                </span>
              }
            />
            <div className="panel-body">
              <div className="between" style={{ marginBottom: 10 }}>
                <span className="muted">Onboarding progress</span>
                <strong>{progress}%</strong>
              </div>
              <Progress value={progress} />
              <p className="muted" style={{ marginTop: 12 }}>
                {tasks.filter((t) => t.status === 'DONE').length} of {tasks.length} steps complete
              </p>
              <Link className="text-link" style={{ marginTop: 17 }} href={`/app/onboarding/${id}`}>
                Open checklist <ArrowUpRight size={15} />
              </Link>
            </div>
          </Panel>
          <Panel>
            <div className="panel-body" style={{ paddingTop: 22 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <ShieldCheck size={18} className="accent-text" />
                <strong>Handled with care.</strong>
              </div>
              <p className="muted">
                Private details and documents are visible only to this employee and HR.
              </p>
              {admin && id !== session?.employeeId && person.status !== 'TERMINATED' && (
                <Button
                  variant="ghost"
                  style={{ marginTop: 18, color: '#c35b50', paddingLeft: 0 }}
                  onClick={() => setArchiving(true)}
                >
                  <Archive size={16} />
                  Archive employee
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </div>
      <EmployeeDialog open={editing} onOpenChange={setEditing} employee={person} />
      <Modal
        open={archiving}
        onOpenChange={setArchiving}
        title={`Archive ${person.firstName}’s record?`}
        description="Their history stays intact. Their workspace sign-in will be disabled."
      >
        <p className="muted">You can reactivate the employee from their profile later.</p>
        <div className="dialog-footer">
          <Button variant="secondary" onClick={() => setArchiving(false)}>
            Keep employee
          </Button>
          <Button variant="danger" loading={archive.isPending} onClick={() => archive.mutate()}>
            Archive employee
          </Button>
        </div>
      </Modal>
    </>
  );
}
