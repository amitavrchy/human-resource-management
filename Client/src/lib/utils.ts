import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
export const label = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_.]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const dateLabel = (value: string | null | undefined, pattern = 'MMM d, yyyy') =>
  value ? format(parseISO(value.slice(0, 10)), pattern) : '—';
export const isAdmin = (role?: string) => role === 'OWNER' || role === 'HR_ADMIN';
export const canRecruit = (role?: string) =>
  ['OWNER', 'HR_ADMIN', 'RECRUITER'].includes(role ?? '');
export function csvDownload(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          let text = String(value ?? '');
          if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
