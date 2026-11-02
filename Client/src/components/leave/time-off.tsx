'use client';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Balance, Employee, LeaveRequest, Metadata } from '@/lib/types';
import { cn, dateLabel, fullName, isAdmin, label } from '@/lib/utils';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Panel,
  PanelHeader,
  Progress,
  Tabs,
} from '@/components/ui/core';

interface RequestValues {
  employeeId: string;
  policyId: string;
  startDate: string;
  endDate: string;
  reason: string;
}
function RequestForm({ close }: { close: () => void }) {
  const { data: session } = useSession();
  const meta = useApi<Metadata>('/organization/metadata');
  const people = useApi<Employee[]>('/employees/org-tree', isAdmin(session?.role));
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestValues>({
    defaultValues: {
      employeeId: session?.employeeId ?? '',
      policyId: '',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });
  const employeeId = useWatch({ control, name: 'employeeId' });
  const start = useWatch({ control, name: 'startDate' });
  const end = useWatch({ control, name: 'endDate' });
  const balances = useApi<Balance[]>(
    `/leave-balances?employeeId=${encodeURIComponent(employeeId)}${start ? `&year=${start.slice(0, 4)}` : ''}`,
    !!employeeId && (!start || start.length === 10),
  );
  const save = useAction(
    async (values: RequestValues) => (await api.post('/leave-requests', values)).data,
    { success: 'A little time for you. Request sent.', onSuccess: close },
  );
  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))}>
      <div className="stack-sm">
        {isAdmin(session?.role) && (
          <Field label="Request for" error={errors.employeeId?.message}>
            <select
              value={employeeId}
              {...register('employeeId', { required: 'Choose an employee.' })}
            >
              <option value="">Choose a teammate</option>
              {people.data?.map((person) => (
                <option key={person.id} value={person.id}>
                  {fullName(person)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Leave policy" error={errors.policyId?.message}>
          <select {...register('policyId', { required: 'Choose a leave policy.' })}>
            <option value="">Choose a policy</option>
            {meta.data?.policies.map((policy) => {
              const balance = balances.data?.find((item) => item.policyId === policy.id);
              return (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                  {balance ? ` · ${balance.balanceDays - balance.pendingDays} days available` : ''}
                </option>
              );
            })}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="From" error={errors.startDate?.message}>
            <input type="date" {...register('startDate', { required: 'Choose a start date.' })} />
          </Field>
          <Field label="Through" error={errors.endDate?.message}>
            <input
              type="date"
              min={start || undefined}
              {...register('endDate', {
                required: 'Choose an end date.',
                validate: (value) => !start || value >= start || 'End date must follow start date.',
              })}
            />
          </Field>
        </div>
        <div className="day-picker-wrap">
          <DayPicker
            mode="range"
            selected={
              start ? { from: parseISO(start), to: end ? parseISO(end) : undefined } : undefined
            }
            onSelect={(range) => {
              setValue('startDate', range?.from ? format(range.from, 'yyyy-MM-dd') : '', {
                shouldValidate: true,
              });
              setValue(
                'endDate',
                range?.to
                  ? format(range.to, 'yyyy-MM-dd')
                  : range?.from
                    ? format(range.from, 'yyyy-MM-dd')
                    : '',
                { shouldValidate: true },
              );
            }}
          />
        </div>
        <Field
          label="A note for your approver"
          hint="Optional. Share only what you’re comfortable with."
        >
          <textarea
            rows={2}
            maxLength={1000}
            placeholder="A little time to recharge…"
            {...register('reason')}
          />
        </Field>
        <p className="field-hint">
          Only working days count. Requests spanning two calendar years should be submitted
          separately.
        </p>
      </div>
      <div className="dialog-footer">
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!employeeId}>
          Send request
        </Button>
      </div>
    </form>
  );
}
function TeamCalendar({ requests }: { requests: LeaveRequest[] }) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <>
      <Panel>
        <PanelHeader
          title={format(month, 'MMMM yyyy')}
          description="Approved time away in your accessible team"
          action={
            <div className="row" style={{ gap: 5 }}>
              <Button
                variant="ghost"
                aria-label="Previous month"
                onClick={() => setMonth((value) => addMonths(value, -1))}
              >
                <ChevronLeft size={17} />
              </Button>
              <Button variant="secondary" onClick={() => setMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button
                variant="ghost"
                aria-label="Next month"
                onClick={() => setMonth((value) => addMonths(value, 1))}
              >
                <ChevronRight size={17} />
              </Button>
            </div>
          }
        />
        <div className="calendar-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const events = requests.filter(
              (request) =>
                request.status === 'APPROVED' &&
                request.startDate.slice(0, 10) <= key &&
                request.endDate.slice(0, 10) >= key,
            );
            return (
              <div
                key={key}
                className={cn(
                  'calendar-day',
                  !isSameMonth(day, month) && 'other-month',
                  isToday(day) && 'today',
                )}
              >
                <span>{format(day, 'd')}</span>
                {events.slice(0, 2).map((request) => (
                  <button
                    key={request.id}
                    className="calendar-event"
                    style={{ border: 0, width: '100%', textAlign: 'left' }}
                    onClick={() => setSelected(request)}
                    title={`${fullName(request.employee)} · ${request.policy.name}`}
                  >
                    {request.employee.firstName}
                  </button>
                ))}
                {events.length > 2 && (
                  <button className="text-link" onClick={() => setSelected(events[2])}>
                    +{events.length - 2} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <Modal
        open={!!selected}
        onOpenChange={() => setSelected(null)}
        title={selected ? fullName(selected.employee) : 'Time away'}
        description={selected?.policy.name}
      >
        {selected && (
          <div className="stack-sm">
            <p>
              {dateLabel(selected.startDate)} – {dateLabel(selected.endDate)}
            </p>
            <p className="muted">
              {selected.days} working {selected.days === 1 ? 'day' : 'days'}
            </p>
            <Badge value={selected.status} />
          </div>
        )}
      </Modal>
    </>
  );
}
export function TimeOff() {
  const { data: session } = useSession();
  const requests = useApi<LeaveRequest[]>('/leave-requests');
  const balances = useApi<Balance[]>('/leave-balances', !!session?.employeeId);
  const [tab, setTab] = useState('all');
  const [adding, setAdding] = useState(false);
  const [decision, setDecision] = useState<{
    request: LeaveRequest;
    action: 'approve' | 'reject' | 'cancel';
  } | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const canApprove = isAdmin(session?.role) || session?.role === 'MANAGER';
  const pending =
    requests.data?.filter(
      (request) => request.status === 'PENDING' && request.employeeId !== session?.employeeId,
    ) ?? [];
  const items = useMemo(
    () =>
      requests.data?.filter((request) =>
        tab === 'mine'
          ? request.employeeId === session?.employeeId
          : tab === 'approvals'
            ? request.status === 'PENDING' && request.employeeId !== session?.employeeId
            : true,
      ) ?? [],
    [requests.data, tab, session?.employeeId],
  );
  const decide = useAction(
    async (value: NonNullable<typeof decision>) =>
      (await api.post(`/leave-requests/${value.request.id}/${value.action}`)).data,
    { success: 'Leave request updated.', onSuccess: () => setDecision(null) },
  );
  const open = adding || params.get('request') === '1';
  const close = (value: boolean) => {
    setAdding(value);
    if (!value && params.has('request')) router.replace('/app/time-off', { scroll: false });
  };
  return (
    <>
      <PageHeader
        title="A little time for life."
        description="Clear balances, thoughtful planning and room to recharge."
        action={
          (!!session?.employeeId || isAdmin(session?.role)) && (
            <Button onClick={() => setAdding(true)}>
              <Plus size={17} />
              Request time off
            </Button>
          )
        }
      />
      {!!balances.data?.length && (
        <div className="balance-grid">
          {balances.data.map((balance) => (
            <Panel className="balance-card" key={balance.id}>
              <h3>{balance.policy.name}</h3>
              <div className="balance-value">
                {Math.max(0, balance.balanceDays - balance.pendingDays)}
                <span>days available</span>
              </div>
              <p>
                {balance.pendingDays
                  ? `${balance.pendingDays} days pending approval`
                  : `${balance.policy.annualDays} days annual entitlement`}{' '}
                · {balance.year}
              </p>
              <Progress
                value={
                  balance.policy.annualDays
                    ? ((balance.balanceDays - balance.pendingDays) / balance.policy.annualDays) *
                      100
                    : 0
                }
                label={`${balance.policy.name} available balance`}
              />
            </Panel>
          ))}
        </div>
      )}
      {balances.error && (
        <div className="notice" role="alert" style={{ marginBottom: 20 }}>
          Your leave balance could not be loaded.{' '}
          <button className="text-link" onClick={() => void balances.refetch()}>
            Try again
          </button>
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All requests', count: requests.data?.length },
          { value: 'mine', label: 'My requests' },
          ...(canApprove
            ? [{ value: 'approvals', label: 'Approvals', count: pending.length }]
            : []),
          { value: 'calendar', label: 'Team calendar' },
        ]}
      />
      {requests.isPending ? (
        <Loading />
      ) : requests.error ? (
        <ErrorState error={requests.error} retry={() => void requests.refetch()} />
      ) : tab === 'calendar' ? (
        <TeamCalendar requests={requests.data} />
      ) : (
        <Panel>
          {items.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">Time-off requests</caption>
                <thead>
                  <tr>
                    <th scope="col">Team member</th>
                    <th scope="col">Policy</th>
                    <th scope="col">Dates</th>
                    <th scope="col">Days</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <div className="person-cell">
                          <Avatar name={fullName(request.employee)} />
                          <span>
                            <strong>{fullName(request.employee)}</strong>
                            <small>{request.employee.department?.name ?? 'Team member'}</small>
                          </span>
                        </div>
                      </td>
                      <td>{request.policy.name}</td>
                      <td>
                        {dateLabel(request.startDate, 'MMM d')} –{' '}
                        {dateLabel(request.endDate, 'MMM d, yyyy')}
                        <small
                          className="muted"
                          style={{
                            display: 'block',
                            maxWidth: 230,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={request.reason ?? undefined}
                        >
                          {request.reason}
                        </small>
                      </td>
                      <td>{request.days}</td>
                      <td>
                        <Badge value={request.status} />
                      </td>
                      <td>
                        <div className="row" style={{ gap: 5 }}>
                          {canApprove &&
                            request.status === 'PENDING' &&
                            request.employeeId !== session?.employeeId && (
                              <>
                                <Button
                                  variant="secondary"
                                  aria-label={`Approve ${request.employee.firstName}'s request`}
                                  onClick={() => setDecision({ request, action: 'approve' })}
                                >
                                  <Check size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  aria-label={`Reject ${request.employee.firstName}'s request`}
                                  onClick={() => setDecision({ request, action: 'reject' })}
                                >
                                  <X size={16} />
                                </Button>
                              </>
                            )}
                          {(request.employeeId === session?.employeeId || isAdmin(session?.role)) &&
                            (request.status === 'PENDING' ||
                              (request.status === 'APPROVED' &&
                                request.startDate.slice(0, 10) >
                                  new Date().toISOString().slice(0, 10))) && (
                              <Button
                                variant="ghost"
                                onClick={() => setDecision({ request, action: 'cancel' })}
                              >
                                Cancel
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={tab === 'approvals' ? 'Everything’s caught up.' : 'Room to recharge.'}
              description={
                tab === 'approvals'
                  ? 'No requests are waiting for your approval.'
                  : 'Time-off requests will appear here when they’re submitted.'
              }
              icon={<CalendarDays size={26} />}
            />
          )}
        </Panel>
      )}
      <Modal
        open={open}
        onOpenChange={close}
        title="Make a little time for you."
        description="Choose your dates and send a request to your approver."
      >
        <RequestForm close={() => close(false)} />
      </Modal>
      <Modal
        open={!!decision}
        onOpenChange={() => setDecision(null)}
        title={`${label(decision?.action ?? 'review')} this request?`}
        description={
          decision
            ? `${fullName(decision.request.employee)} · ${decision.request.policy.name}`
            : undefined
        }
      >
        {decision && (
          <>
            <p>
              {dateLabel(decision.request.startDate)} – {dateLabel(decision.request.endDate)}
            </p>
            <p className="muted" style={{ marginTop: 8 }}>
              {decision.request.days} working {decision.request.days === 1 ? 'day' : 'days'}.{' '}
              {decision.action === 'approve'
                ? 'These days will be deducted from the leave balance.'
                : decision.action === 'reject'
                  ? 'The leave balance stays the same.'
                  : 'Any approved days will be returned to the balance.'}
            </p>
            <div className="dialog-footer">
              <Button variant="secondary" onClick={() => setDecision(null)}>
                Go back
              </Button>
              <Button
                variant={decision.action === 'reject' ? 'danger' : 'primary'}
                loading={decide.isPending}
                onClick={() => decide.mutate(decision)}
              >
                {label(decision.action)} request
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
