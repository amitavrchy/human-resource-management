'use client';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Copy, Download, Sparkles, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import { Button, Field } from '@/components/ui/core';

import type { Job } from '@/lib/types';
interface Values {
  jobId?: string;
  title: string;
  department: string;
  level: string;
  mustHaves: string;
  tone: string;
}
export function JdGenerator({
  initialTitle = '',
  initialDepartment = '',
  onUse,
}: {
  initialTitle?: string;
  initialDepartment?: string;
  onUse?: (markdown: string) => void;
}) {
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      title: initialTitle,
      department: initialDepartment,
      level: 'Mid-level',
      mustHaves: '',
      tone: 'professional',
    },
  });
  const { data: session } = useSession();
  const manager = session?.role === 'MANAGER';
  const jobs = useApi<Job[]>('/jobs', manager);
  const jobId = useWatch({ control, name: 'jobId' });
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const generate = useAction(
    async (values: Values) =>
      (
        await api.post<{ markdown: string }>('/ai/jd', {
          ...values,
          mustHaves: values.mustHaves
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        })
      ).data,
    { onSuccess: (data) => setResult(data.markdown) },
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the description and copy it manually.');
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([result], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'job-description.md';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="stack">
      <form onSubmit={handleSubmit((values) => generate.mutate(values))}>
        <div className="form-grid">
          {manager && (
            <Field label="Your assigned role" className="full">
              <select
                required
                {...register('jobId', {
                  required: true,
                  onChange: (event) => {
                    const job = jobs.data?.find((item) => item.id === event.target.value);
                    if (job) {
                      setValue('title', job.title);
                      setValue('department', job.department ?? 'Team');
                    }
                  },
                })}
              >
                <option value="">Choose one of your roles</option>
                {jobs.data?.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Job title" error={errors.title?.message}>
            <input
              maxLength={160}
              placeholder="Senior Product Designer"
              {...register('title', { required: 'Enter a role title.', minLength: 2 })}
            />
          </Field>
          <Field label="Department" error={errors.department?.message}>
            <input
              maxLength={120}
              placeholder="Design"
              {...register('department', { required: 'Enter a department.' })}
            />
          </Field>
          <Field label="Experience level">
            <select {...register('level')}>
              <option>Entry-level</option>
              <option>Mid-level</option>
              <option>Senior</option>
              <option>Lead</option>
              <option>Executive</option>
            </select>
          </Field>
          <Field label="Tone">
            <select {...register('tone')}>
              <option value="professional">Professional</option>
              <option value="friendly">Warm and friendly</option>
              <option value="concise">Clear and concise</option>
            </select>
          </Field>
          <Field
            label="Must-have skills"
            hint="One requirement per line. Keep these specific to the role."
            className="full"
          >
            <textarea
              rows={4}
              maxLength={6000}
              placeholder={'Interaction design\nUser research\nClear communication'}
              {...register('mustHaves')}
            />
          </Field>
        </div>
        <div className="dialog-footer" style={{ marginTop: 20 }}>
          <Button type="submit" loading={generate.isPending} disabled={manager && !jobId}>
            <Sparkles size={17} />
            {result ? 'Generate again' : 'Generate description'}
          </Button>
        </div>
      </form>
      {result && (
        <div className="stack-sm">
          <div className="between">
            <h3>Your starting point</h3>
            <div className="row" style={{ gap: 5 }}>
              <Button variant="ghost" onClick={() => void copy()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="ghost" onClick={download}>
                <Download size={16} />
                Save
              </Button>
            </div>
          </div>
          <textarea
            rows={14}
            aria-label="Generated job description"
            value={result}
            onChange={(event) => setResult(event.target.value)}
            maxLength={30000}
          />
          <p className="field-hint">
            Review the draft and add your company’s actual benefits before publishing the role.
          </p>
          {onUse && (
            <Button onClick={() => onUse(result)}>
              Use this description <ArrowRight size={16} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
