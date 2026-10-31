'use client';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, Download, FileText, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import type { Document, Employee } from '@/lib/types';
import { dateLabel, fullName, isAdmin } from '@/lib/utils';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import { Badge, Button, EmptyState, ErrorState, Field, Loading, Modal, PageHeader, Panel, Tabs } from '@/components/ui/core';

interface Values { title: string; category: string; employeeId: string; isHandbook: boolean; contentText: string }
function UploadForm({ close }: { close: () => void }) {
  const people = useApi<Employee[]>('/employees/org-tree');
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState<File | null>(null);
  const { register, handleSubmit, control, formState: { errors } } = useForm<Values>({ defaultValues: { title: '', category: 'policy', employeeId: '', isHandbook: false, contentText: '' } });
  const category = useWatch({ control, name: 'category' });
  const employeeId = useWatch({ control, name: 'employeeId' });
  const upload = useAction(async (values: Values) => {
    const data = { ...values, employeeId: values.employeeId || undefined, isHandbook: values.category === 'policy' && !values.employeeId && values.isHandbook };
    let document: Document;
    if (mode === 'file') {
      if (!file) throw new Error('Choose a file first.');
      const body = new FormData();
      for (const [key, value] of Object.entries(data)) if (value !== undefined && (key !== 'contentText' || value)) body.append(key, String(value));
      body.append('file', file);
      document = (await api.post<Document>('/documents/upload', body)).data;
    } else document = (await api.post<Document>('/documents', data)).data;
    return document;
  }, { success: 'Document saved. A little more organized.', onSuccess: document => { if (document.isHandbook && document.ingestStatus !== 'READY') toast.info('Your document is saved. Copilot indexing needs another try.'); close(); } });
  return <form onSubmit={handleSubmit(values => upload.mutate(values))}><Tabs value={mode} onChange={setMode} tabs={[{ value: 'file', label: 'Upload a file' }, { value: 'text', label: 'Write a document' }]} /><div className="stack-sm"><Field label="Document title" error={errors.title?.message}><input maxLength={160} placeholder="Employee handbook" {...register('title', { required: 'Give this document a title.', minLength: 2 })} /></Field><div className="form-grid"><Field label="Category"><select {...register('category')}><option value="policy">Company policy</option><option value="personal">Personal document</option><option value="contract">Contract</option></select></Field><Field label="Employee" error={errors.employeeId?.message}><select {...register('employeeId', { validate: value => category === 'policy' || !!value || 'Choose an employee for private documents.' })}><option value="">Company-wide</option>{people.data?.map(person => <option value={person.id} key={person.id}>{fullName(person)}</option>)}</select></Field></div>{mode === 'file' ? <Field label="Choose a file" hint="PDF, text, Markdown, PNG or JPEG. Up to 10 MB."><input type="file" accept=".pdf,.txt,.md,.png,.jpg,.jpeg" required onChange={event => setFile(event.target.files?.[0] ?? null)} /></Field> : <Field label="Document content" error={errors.contentText?.message}><textarea rows={9} maxLength={200000} {...register('contentText', { validate: text => mode !== 'text' || text.trim().length >= 20 || 'Add at least 20 characters.' })} /></Field>}{category === 'policy' && !employeeId && <label className="checkbox-field"><input type="checkbox" {...register('isHandbook')} /><span>Make this a Copilot source<small>Your team can ask questions and receive answers with citations from this policy.</small></span></label>}<p className="field-hint">Personal documents and contracts are private to the employee and HR. Company-wide policies are visible to all workspace members.</p></div><div className="dialog-footer"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" loading={upload.isPending} disabled={mode === 'file' && !file}>Save document</Button></div></form>;
}
export function Documents() {
  const documents = useApi<Document[]>('/documents');
  const { data: session } = useSession();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const remove = useAction(async (id: string) => (await api.delete(`/documents/${id}`)).data, { success: 'Document removed.', onSuccess: () => setDeleting(null) });
  const index = useAction(async (id: string) => (await api.post('/ai/ingest-handbook', { documentId: id })).data, { success: 'Your policy is ready for Copilot.' });
  const filtered = documents.data?.filter(doc => (tab === 'all' || tab === 'handbook' ? tab !== 'handbook' || doc.isHandbook : doc.category === tab) && `${doc.title} ${doc.employee ? fullName(doc.employee) : ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const download = async (doc: Document) => { setDownloading(doc.id); const ext = ({ 'application/pdf': '.pdf', 'text/plain': '.txt', 'image/png': '.png', 'image/jpeg': '.jpg' } as Record<string, string>)[doc.mimeType] ?? ''; try { await downloadFile(`/documents/${doc.id}/download`, doc.title + ext); } catch (error) { toast.error(errorMessage(error)); } finally { setDownloading(null); } };
  return <><PageHeader title="Everything, in its place." description="Company knowledge and personal paperwork. A little easier to find." action={isAdmin(session?.role) && <Button onClick={() => setAdding(true)}><Plus size={17} />Add document</Button>} /><div className="welcome-banner"><div><h2>A handbook that answers back.</h2><p>Ask Copilot about your company’s indexed policies.</p><Link href="/app/ai" className="text-link">Ask your handbook <ArrowUpRight size={16} /></Link></div><div className="banner-art" aria-hidden="true"><span className="orbit-ring" /><span className="orbit-core"><BookOpen size={25} /></span></div></div><Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All documents', count: documents.data?.length }, { value: 'policy', label: 'Policies' }, { value: 'personal', label: 'Personal files' }, { value: 'contract', label: 'Contracts' }, { value: 'handbook', label: 'Copilot sources' }]} /><div className="toolbar"><div className="search-field"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a document…" aria-label="Search documents" /></div><span className="muted">{filtered.length} documents</span></div>{documents.isPending ? <Loading /> : documents.error ? <ErrorState error={documents.error} retry={() => void documents.refetch()} /> : filtered.length ? <div className="documents-grid">{filtered.map(doc => <Panel className="document-card" key={doc.id}><div className="between"><span className="document-icon"><FileText size={25} strokeWidth={1.4} /></span>{isAdmin(session?.role) && <button className="icon-button" aria-label={`Delete ${doc.title}`} onClick={() => setDeleting(doc)}><Trash2 size={16} /></button>}</div><h3>{doc.title}</h3><p>{doc.employee ? fullName(doc.employee) : 'Company-wide'} · {dateLabel(doc.createdAt, 'MMM d')}</p><div className="row wrap"><Badge value={doc.category} />{doc.isHandbook && <Badge value={doc.ingestStatus}>{doc.ingestStatus === 'READY' ? 'Copilot ready' : doc.ingestStatus === 'PROCESSING' ? 'Indexing' : 'Needs indexing'}</Badge>}</div><div className="document-card-actions"><Button variant="ghost" style={{ paddingLeft: 0 }} loading={downloading === doc.id} onClick={() => void download(doc)}><Download size={16} />Download</Button>{doc.isHandbook && doc.ingestStatus !== 'READY' && isAdmin(session?.role) ? <Button variant="ghost" aria-label={`Index ${doc.title}`} loading={index.isPending && index.variables === doc.id} onClick={() => index.mutate(doc.id)}><RefreshCw size={15} />Index</Button> : <span className="muted">{doc.size < 1024 ? `${doc.size} B` : `${Math.round(doc.size / 1024)} KB`}</span>}</div></Panel>)}</div> : <Panel><EmptyState title="A place for what matters." description="Upload company policies or employee documents to keep them close at hand." icon={<FileText size={27} />} action={isAdmin(session?.role) && <Button onClick={() => setAdding(true)}><Plus size={16} />Add document</Button>} /></Panel>}<Modal open={adding} onOpenChange={setAdding} title="A little more organized." description="Give this document a title and a safe place in your workspace."><UploadForm close={() => setAdding(false)} /></Modal><Modal open={!!deleting} onOpenChange={() => setDeleting(null)} title="Remove this document?" description={deleting?.title}><p className="muted">The file will be permanently removed. Copilot will stop using it as a source immediately.</p><div className="dialog-footer"><Button variant="secondary" onClick={() => setDeleting(null)}>Keep document</Button><Button variant="danger" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>Remove document</Button></div></Modal></>;
}
