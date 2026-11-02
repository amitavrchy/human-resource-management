'use client';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  SearchX,
  X,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useId } from 'react';
import { cn, initials, label } from '@/lib/utils';
import { errorMessage } from '@/lib/api';

export function Button({
  variant = 'primary',
  className,
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn('btn', `btn-${variant}`, className)}
    >
      {loading && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const color = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
  return (
    <span
      aria-hidden="true"
      className={cn('avatar', `avatar-${size}`, `avatar-color-${color}`, className)}
    >
      {initials(name)}
    </span>
  );
}
export function Badge({
  children,
  value,
  className,
}: {
  children?: React.ReactNode;
  value?: string;
  className?: string;
}) {
  return (
    <span className={cn('badge', `badge-${(value ?? '').toLowerCase()}`, className)}>
      <span className="badge-dot" />
      {children ?? label(value ?? '')}
    </span>
  );
}
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  back,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
  back?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        {back && (
          <Link className="back-link" href={back}>
            <ArrowLeft size={16} />
            Back
          </Link>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </div>
  );
}
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('panel', className)}>{children}</section>;
}
export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon ?? <SearchX size={26} />}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Loading({ label: text = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={26} />
      <p>{text}</p>
      <div className="skeleton-lines">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <AlertCircle size={28} />
      <h3>We couldn’t load this</h3>
      <p>{errorMessage(error)}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={cn('dialog', wide && 'dialog-wide')}
          onInteractOutside={(event) => {
            if ((event.target as HTMLElement)?.closest('[data-radix-popper-content-wrapper]'))
              event.preventDefault();
          }}
        >
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="dialog-description">
            {description ?? 'Complete the details below.'}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label: text,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactElement<{
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }>;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('field', className)}>
      <label htmlFor={children.props.id ?? id}>{text}</label>
      {/* Field controls receive stable IDs through cloning. */}
      <FieldControl
        control={children}
        id={children.props.id ?? id}
        error={!!error}
        described={error || hint ? `${id}-hint` : undefined}
      />
      {(error || hint) && (
        <span id={`${id}-hint`} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}
import { cloneElement } from 'react';
function FieldControl({
  control,
  id,
  error,
  described,
}: {
  control: React.ReactElement<{
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }>;
  id: string;
  error: boolean;
  described?: string;
}) {
  return cloneElement(control, {
    id,
    'aria-invalid': error || undefined,
    'aria-describedby': described,
  });
}
export function Progress({ value, label: text }: { value: number; label?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={text ?? 'Progress'}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.span
        initial={false}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.25 }}
      />
    </div>
  );
}
export function Pagination({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} {total === 1 ? 'result' : 'results'} · Page {page} of {pages}
      </span>
      <div>
        <Button
          variant="secondary"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </Button>
        <Button
          variant="secondary"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={17} />
        </Button>
      </div>
    </div>
  );
}
export function SortIcon() {
  return <ArrowUpDown size={14} aria-hidden="true" />;
}
export function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: { value: string; label: string; count?: number }[];
}) {
  return (
    <div className="tabs" aria-label="Sections">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={cn('tab', tab.value === value && 'active')}
          aria-pressed={tab.value === value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span>{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
