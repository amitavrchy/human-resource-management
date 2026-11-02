'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Search, Sparkles, CalendarDays, Settings2, X } from 'lucide-react';
import { setCommandOpen, useAppDispatch, useAppSelector } from '@/features/store';
import { useApi } from '@/hooks/use-api';
import type { Employee, Paginated } from '@/lib/types';
import { fullName } from '@/lib/utils';
import { Avatar } from '@/components/ui/core';
import { navigation } from './app-shell';

export function CommandPalette() {
  const open = useAppSelector((s) => s.ui.commandOpen);
  const role = useAppSelector((s) => s.auth.session?.role);
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 180);
    return () => clearTimeout(timer);
  }, [search]);
  const employees = useApi<Paginated<Employee>>(
    `/employees?limit=5&q=${encodeURIComponent(debounced)}`,
    open && !!debounced.trim(),
  );
  const pages = [
    ...navigation.filter((item) => (item.roles as readonly string[]).includes(role ?? '')),
    { href: '/app/ai', title: 'AI Copilot', icon: Sparkles },
    { href: '/app/time-off?request=1', title: 'Request time off', icon: CalendarDays },
    { href: '/app/settings', title: 'Settings', icon: Settings2 },
  ].filter((item) => !search || item.title.toLowerCase().includes(search.toLowerCase()));
  const people = debounced && search ? (employees.data?.items ?? []) : [];
  const results = [
    ...people.map((person) => ({
      href: `/app/directory/${person.id}`,
      title: fullName(person),
      subtitle: person.title ?? 'Team member',
      person: true,
      icon: Search,
    })),
    ...pages.map((page) => ({ ...page, subtitle: 'Navigate to page', person: false })),
  ];
  const go = (href: string) => {
    dispatch(setCommandOpen(false));
    setSearch('');
    setIndex(0);
    router.push(href);
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        dispatch(setCommandOpen(value));
        if (!value) {
          setSearch('');
          setIndex(0);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="command-dialog">
          <Dialog.Title className="sr-only">Search your workspace</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search people or pages. Use arrow keys to choose a result and Enter to open it.
          </Dialog.Description>
          <div className="command-input">
            <Search size={22} />
            <input
              placeholder="Search people, pages or actions…"
              aria-label="Search people, pages or actions"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  const next = results.length
                    ? (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
                      results.length
                    : 0;
                  setIndex(next);
                  list.current
                    ?.querySelector(`[data-index="${next}"]`)
                    ?.scrollIntoView({ block: 'nearest' });
                }
                if (event.key === 'Enter' && results[index]) {
                  event.preventDefault();
                  go(results[index].href);
                }
              }}
            />
            <Dialog.Close className="icon-button" aria-label="Close search">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="command-results" ref={list} aria-live="polite">
            {search && employees.isFetching && <p className="command-status">Searching people…</p>}
            {employees.isError && search && (
              <p className="command-status">
                People search is unavailable. You can still open a page.
              </p>
            )}
            {!results.length && (
              <p className="command-status">No results. Try a name or page title.</p>
            )}
            {results.map((result, i) => (
              <button
                key={result.href}
                data-index={i}
                className={i === index ? 'selected' : ''}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(result.href)}
              >
                {result.person ? (
                  <Avatar name={result.title} size="sm" />
                ) : (
                  <span className="command-page-icon">
                    <result.icon size={19} />
                  </span>
                )}
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          <div className="command-footer">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> to navigate
            </span>
            <span>
              <kbd>Enter</kbd> to open
            </span>
            <span>
              <kbd>Esc</kbd> to close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
