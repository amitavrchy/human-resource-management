'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Download, Grid2X2, List, MapPin, Plus, Search } from 'lucide-react';
import type { SortingState } from '@tanstack/react-table';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { csvDownload, dateLabel, fullName, isAdmin } from '@/lib/utils';
import { useApi, useSession } from '@/hooks/use-api';
import type { Employee, Metadata, Paginated } from '@/lib/types';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Pagination,
  Panel,
  Tabs,
} from '@/components/ui/core';
import { DataTable, type TableColumn } from '@/components/data/data-table';
import { EmployeeDialog } from './employee-form';

export function Directory() {
  const { data: session } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'firstName', desc: false }]);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);
  const meta = useApi<Metadata>('/organization/metadata');
  const filters = new URLSearchParams({
    q: query,
    ...(department ? { departmentId: department } : {}),
    ...(location ? { locationId: location } : {}),
    ...(status ? { status } : {}),
    sortBy: sorting[0]?.id ?? 'firstName',
    sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
  });
  const people = useApi<Paginated<Employee>>(`/employees?${filters}&page=${page}&limit=12`);
  const open = (adding || params.get('add') === '1') && isAdmin(session?.role);
  const close = (value: boolean) => {
    setAdding(value);
    if (!value && params.has('add')) router.replace('/app/directory', { scroll: false });
  };
  const columns = useMemo<TableColumn<Employee>[]>(
    () => [
      {
        id: 'firstName',
        header: 'Name',
        accessor: fullName,
        sortable: true,
        cell: (person) => (
          <Link href={`/app/directory/${person.id}`} className="person-cell">
            <Avatar name={fullName(person)} />
            <span>
              <strong>{fullName(person)}</strong>
              <small>{person.workEmail}</small>
            </span>
          </Link>
        ),
      },
      {
        id: 'title',
        header: 'Role',
        accessor: (p) => p.title ?? '—',
        sortable: true,
        cell: (p) => (
          <span>
            {p.title ?? '—'}
            <small className="muted" style={{ display: 'block' }}>
              {p.department?.name ?? 'Unassigned'}
            </small>
          </span>
        ),
      },
      {
        id: 'location',
        header: 'Location',
        accessor: (p) => p.location?.name ?? 'Unassigned',
        cell: (p) => (
          <span className="row muted" style={{ gap: 6 }}>
            <MapPin size={14} />
            {p.location?.name ?? 'Unassigned'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessor: (p) => p.status,
        sortable: true,
        cell: (p) => <Badge value={p.status} />,
      },
      {
        id: 'startDate',
        header: 'Joined',
        accessor: (p) => p.startDate ?? '',
        sortable: true,
        cell: (p) => dateLabel(p.startDate, 'MMM d, yyyy'),
      },
      {
        id: 'actions',
        header: '',
        accessor: (p) => p.id,
        cell: (p) => (
          <Link
            href={`/app/directory/${p.id}`}
            className="icon-button"
            aria-label={`View ${fullName(p)}`}
          >
            <ArrowUpRight size={17} />
          </Link>
        ),
      },
    ],
    [],
  );
  const exportPeople = async () => {
    setExporting(true);
    try {
      const all: Employee[] = [];
      for (let current = 1; ; current++) {
        const result = (
          await api.get<Paginated<Employee>>(`/employees?${filters}&page=${current}&limit=100`)
        ).data;
        all.push(...result.items);
        if (current >= result.pages) break;
      }
      csvDownload('peopleos-directory.csv', [
        ['Employee ID', 'Name', 'Email', 'Title', 'Department', 'Location', 'Status', 'Start date'],
        ...all.map((p) => [
          p.employeeNumber,
          fullName(p),
          p.workEmail,
          p.title,
          p.department?.name,
          p.location?.name,
          p.status,
          p.startDate?.slice(0, 10),
        ]),
      ]);
      toast.success(`${all.length} people exported.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Good people. One place."
        description="Get to know the people who make it all happen."
        action={
          <>
            <Button variant="secondary" onClick={() => void exportPeople()} loading={exporting}>
              <Download size={16} />
              Export
            </Button>
            {isAdmin(session?.role) && (
              <Button onClick={() => setAdding(true)}>
                <Plus size={17} />
                Add teammate
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        tabs={[
          { value: '', label: 'All people', count: status === '' ? people.data?.total : undefined },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'ONBOARDING', label: 'Onboarding' },
          { value: 'LEAVE', label: 'On leave' },
          { value: 'TERMINATED', label: 'Archived' },
        ]}
      />
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or role…"
              aria-label="Search people"
            />
          </div>
          <select
            className="filter-select"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {meta.data?.departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={location}
            onChange={(event) => {
              setLocation(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by location"
          >
            <option value="">All locations</option>
            {meta.data?.locations.map((loc) => (
              <option value={loc.id} key={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-right">
          <div className="view-switch">
            <button
              aria-label="Table view"
              aria-pressed={view === 'table'}
              className={view === 'table' ? 'active' : ''}
              onClick={() => setView('table')}
            >
              <List size={18} />
            </button>
            <button
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
            >
              <Grid2X2 size={17} />
            </button>
          </div>
        </div>
      </div>
      {people.isPending ? (
        <Loading label="Finding your people…" />
      ) : people.error ? (
        <ErrorState error={people.error} retry={() => void people.refetch()} />
      ) : !people.data.items.length ? (
        <Panel>
          <EmptyState
            title="No people found."
            description="Try a different search or add your first teammate."
            action={
              isAdmin(session?.role) && (
                <Button onClick={() => setAdding(true)}>
                  <Plus size={16} />
                  Add teammate
                </Button>
              )
            }
          />
        </Panel>
      ) : view === 'table' ? (
        <Panel>
          <DataTable
            data={people.data.items}
            columns={columns}
            sorting={sorting}
            onSortingChange={(updater) => {
              setSorting(updater);
              setPage(1);
            }}
            caption="Employee directory"
          />
          <Pagination {...people.data} onPage={setPage} />
        </Panel>
      ) : (
        <>
          <div className="employee-grid">
            {people.data.items.map((person) => (
              <Link
                className="panel employee-card"
                key={person.id}
                href={`/app/directory/${person.id}`}
              >
                <div className="employee-card-top">
                  <Avatar name={fullName(person)} size="lg" />
                  <Badge value={person.status} />
                </div>
                <h3>{fullName(person)}</h3>
                <p>{person.title ?? 'Team member'}</p>
                <div className="employee-card-bottom">
                  <span>{person.department?.name ?? 'Unassigned'}</span>
                  <span>
                    <MapPin size={14} />
                    {person.location?.name ?? 'Unassigned'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination {...people.data} onPage={setPage} />
        </>
      )}
      <EmployeeDialog open={open} onOpenChange={close} />
    </>
  );
}
