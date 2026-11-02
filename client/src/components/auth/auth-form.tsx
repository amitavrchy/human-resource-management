'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Brand } from '@/components/layout/app-shell';
import { Button, Field } from '@/components/ui/core';
import { api, errorMessage } from '@/lib/api';

const fields = {
  email: z.email('Enter a valid work email.'),
  password: z.string().min(1, 'Enter your password.').max(72),
  name: z.string().optional(),
  organizationName: z.string().optional(),
  slug: z.string().optional(),
  organizationSlug: z.string().max(60).optional(),
};
type AuthValues = {
  email: string;
  password: string;
  name?: string;
  organizationName?: string;
  slug?: string;
  organizationSlug?: string;
};
export function AuthForm({ registerMode = false }: { registerMode?: boolean }) {
  const schema = z.object(fields).superRefine((data, ctx) => {
    if (!registerMode) return;
    if (data.password.length < 12)
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Use at least 12 characters.' });
    if ((data.name?.trim().length ?? 0) < 2)
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Enter your full name.' });
    if ((data.organizationName?.trim().length ?? 0) < 2)
      ctx.addIssue({
        code: 'custom',
        path: ['organizationName'],
        message: 'Enter your company name.',
      });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug ?? '') || (data.slug?.length ?? 0) < 3)
      ctx.addIssue({
        code: 'custom',
        path: ['slug'],
        message: 'Use 3–60 lowercase letters, numbers or hyphens.',
      });
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const [visible, setVisible] = useState(false);
  const [failure, setFailure] = useState('');
  const router = useRouter();
  const search = useSearchParams();
  const query = useQueryClient();
  const submit = async (values: AuthValues) => {
    setFailure('');
    try {
      await api.post(
        registerMode ? '/auth/register' : '/auth/login',
        registerMode
          ? values
          : {
              email: values.email,
              password: values.password,
              ...(values.organizationSlug?.trim()
                ? { organizationSlug: values.organizationSlug.trim() }
                : {}),
            },
      );
      query.clear();
      const next = search.get('next');
      router.replace(next === '/app' || next?.startsWith('/app/') ? next : '/app');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="hero-pill">
            <Sparkles size={15} />A little more human.
          </span>
          <h1>
            Great teams deserve
            <br />a better place to grow.
          </h1>
          <p>
            Less admin. More connection. One thoughtful home for the moments that make work, work.
          </p>
          {[
            'Your people, beautifully organized',
            'From first hello to first day',
            'Every answer, a little closer',
          ].map((text) => (
            <div className="auth-feature" key={text}>
              <Check size={18} />
              {text}
            </div>
          ))}
        </div>
        <div className="auth-story-footer">People ops without the busywork.</div>
      </aside>
      <main className="auth-form-wrap">
        <Brand />
        <div className="auth-form">
          <h1>{registerMode ? 'A fresh start for your people.' : 'Welcome back.'}</h1>
          <p>
            {registerMode
              ? 'Create your workspace. Make yourself at home.'
              : 'Your people. Your workspace. Right where you left off.'}
          </p>
          {failure && (
            <div className="form-error" role="alert">
              {failure}
            </div>
          )}
          <form onSubmit={handleSubmit(submit)} noValidate>
            {registerMode && (
              <>
                <Field label="Your full name" error={errors.name?.message}>
                  <input
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    maxLength={100}
                    {...register('name')}
                  />
                </Field>
                <Field label="Company name" error={errors.organizationName?.message}>
                  <input
                    autoComplete="organization"
                    placeholder="Orbit Studio"
                    maxLength={120}
                    {...register('organizationName')}
                  />
                </Field>
                <Field
                  label="Workspace handle"
                  error={errors.slug?.message}
                  hint="A unique name, like orbit-studio."
                >
                  <input placeholder="orbit-studio" maxLength={60} {...register('slug')} />
                </Field>
              </>
            )}
            <Field label="Work email" error={errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                maxLength={254}
                {...register('email')}
              />
            </Field>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-control">
                <input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={registerMode ? 'new-password' : 'current-password'}
                  placeholder={registerMode ? 'At least 12 characters' : 'Enter your password'}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? 'Hide password' : 'Show password'}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <span className="field-error" id="password-error">
                  {errors.password.message}
                </span>
              )}
            </div>
            {!registerMode && (
              <details style={{ margin: '10px 0 18px' }}>
                <summary className="muted" style={{ cursor: 'pointer' }}>
                  Choose a specific workspace (optional)
                </summary>
                <Field
                  label="Workspace handle"
                  hint="Use this when your account belongs to more than one workspace."
                >
                  <input
                    maxLength={60}
                    placeholder="orbit-demo"
                    {...register('organizationSlug')}
                  />
                </Field>
              </details>
            )}
            <Button type="submit" loading={isSubmitting}>
              {registerMode ? 'Create workspace' : 'Sign in'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="auth-footnote">
            {registerMode ? 'Already have a workspace?' : 'New to PeopleOS?'}{' '}
            <Link className="text-link" href={registerMode ? '/login' : '/register'}>
              {registerMode ? 'Sign in' : 'Create a workspace'}
            </Link>
          </div>
          <div className="auth-divider" />
          <p className="text-center muted">A little less busywork. A lot more people.</p>
        </div>
      </main>
    </div>
  );
}
