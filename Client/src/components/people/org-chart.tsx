'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Maximize2, Minus, Plus, Users } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import type { Employee } from '@/lib/types';
import { fullName } from '@/lib/utils';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
} from '@/components/ui/core';

function Branch({
  employee,
  childrenMap,
  visited = new Set<string>(),
}: {
  employee: Employee;
  childrenMap: Map<string, Employee[]>;
  visited?: Set<string>;
}) {
  if (visited.has(employee.id)) return null;
  const next = new Set(visited).add(employee.id);
  const children = childrenMap.get(employee.id) ?? [];
  return (
    <div className="org-branch">
      <Link href={`/app/directory/${employee.id}`} className="org-node">
        <Avatar name={fullName(employee)} />
        <span>
          <strong>{fullName(employee)}</strong>
          <small>{employee.title ?? 'Team member'}</small>
        </span>
      </Link>
      {!!children.length && (
        <div className="org-children">
          {children.map((child) => (
            <Branch key={child.id} employee={child} childrenMap={childrenMap} visited={next} />
          ))}
        </div>
      )}
    </div>
  );
}
export function OrgChart() {
  const people = useApi<Employee[]>('/employees/org-tree');
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const model = useMemo(() => {
    const data = people.data ?? [];
    const ids = new Set(data.map((p) => p.id));
    const map = new Map<string, Employee[]>();
    for (const employee of data)
      if (employee.managerId && ids.has(employee.managerId))
        map.set(employee.managerId, [...(map.get(employee.managerId) ?? []), employee]);
    return { map, roots: data.filter((p) => !p.managerId || !ids.has(p.managerId)) };
  }, [people.data]);
  const fit = () => {
    const element = viewport.current;
    if (element) {
      const chart = element.firstElementChild as HTMLElement;
      setZoom(Math.min(1, Math.max(0.3, (element.clientWidth - 48) / (chart.scrollWidth / zoom))));
      element.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  };
  if (people.isPending) return <Loading />;
  if (people.error) return <ErrorState error={people.error} retry={() => void people.refetch()} />;
  return (
    <>
      <PageHeader
        title="Every connection, a little clearer."
        description="See how your people come together. Scroll to explore, or zoom out for the bigger picture."
      />
      <Panel>
        <div className="org-toolbar">
          <span className="row muted">
            <Users size={17} />
            {people.data.length} people · {model.roots.length} reporting{' '}
            {model.roots.length === 1 ? 'tree' : 'trees'}
          </span>
          <div className="row" style={{ gap: 4 }}>
            <Button
              variant="ghost"
              aria-label="Zoom out"
              disabled={zoom <= 0.3}
              onClick={() => setZoom((value) => Math.max(0.3, value - 0.1))}
            >
              <Minus size={17} />
            </Button>
            <span className="muted" style={{ minWidth: 45, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              aria-label="Zoom in"
              disabled={zoom >= 1.4}
              onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}
            >
              <Plus size={17} />
            </Button>
            <Button variant="secondary" onClick={fit}>
              <Maximize2 size={16} />
              Fit
            </Button>
          </div>
        </div>
        {people.data.length ? (
          <div
            className="org-viewport"
            ref={viewport}
            tabIndex={0}
            role="region"
            aria-label="Scrollable organization chart"
          >
            <div className="org-tree" style={{ zoom }}>
              {model.roots.map((root) => (
                <Branch key={root.id} employee={root} childrenMap={model.map} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Your team starts here."
            description="Add people and assign managers to bring your org chart to life."
          />
        )}
      </Panel>
    </>
  );
}
