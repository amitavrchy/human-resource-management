'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, FileText, LoaderCircle, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { ChatReply, Document, Job } from '@/lib/types';
import { canRecruit } from '@/lib/utils';
import { useApi, useSession } from '@/hooks/use-api';
import { Avatar, Badge, Button, EmptyState, ErrorState, Field, Loading, PageHeader, Panel, PanelHeader, Tabs } from '@/components/ui/core';
import { JdGenerator } from './jd-generator';

interface ChatMessage { id: string; role: 'user' | 'assistant' | 'error'; text: string; citations?: ChatReply['citations'] }
function PolicyChat() {
  const { data: session } = useSession();
  const documents = useApi<Document[]>('/documents');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const send = useMutation({ mutationFn: async (message: string) => (await api.post<ChatReply>('/ai/chat', { message })).data });
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, send.isPending]);
  const ask = async (text: string) => {
    if (send.isPending || !text.trim()) return;
    const message = text.trim();
    setInput('');
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'user', text: message }]);
    try { const result = await send.mutateAsync(message); setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'assistant', text: result.answer, citations: result.citations }]); }
    catch (error) { setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'error', text: errorMessage(error) }]); setInput(message); }
  };
  const sources = documents.data?.filter(document => document.isHandbook && document.ingestStatus === 'READY') ?? [];
  return <div className="ai-layout"><Panel className="ai-chat"><PanelHeader title="Your handbook, a little more helpful" description="Answers grounded in your company’s indexed policies." action={!!messages.length && <Button variant="ghost" disabled={send.isPending} onClick={() => setMessages([])}>New chat</Button>} />{!messages.length ? <div className="chat-welcome"><span className="ai-orb"><Sparkles size={31} strokeWidth={1.5} /></span><h2>A little clarity, whenever you need it.</h2><p>Ask a complete question about company policy. I’ll find the relevant handbook passages and show you where the answer comes from.</p><div className="suggestions">{['How many days of annual leave do I have?', 'What is our remote work policy?', 'What equipment is provided during onboarding?'].map(question => <button key={question} onClick={() => void ask(question)}>{question}<ArrowUpRight size={16} /></button>)}</div></div> : <div className="chat-messages" role="log" aria-live="polite" aria-label="Policy conversation">{messages.map(message => <div className={`chat-message ${message.role}`} key={message.id}>{message.role === 'user' ? <Avatar name={session?.user.name ?? 'You'} size="sm" /> : <span className="stat-icon"><Sparkles size={18} /></span>}<div className="chat-message-content"><strong>{message.role === 'user' ? 'You' : message.role === 'error' ? 'Couldn’t reach Copilot' : 'PeopleOS Copilot'}</strong><p className={message.role === 'error' ? 'field-error' : undefined}>{message.text}</p>{message.citations?.map(citation => <div className="citation" key={citation.id}><strong><FileText size={14} />{citation.title}</strong><p>{citation.excerpt}</p><Link className="text-link" href="/app/documents" style={{ marginTop: 6 }}>Open policy library <ArrowUpRight size={14} /></Link></div>)}</div></div>)}{send.isPending && <div className="row muted" role="status"><LoaderCircle size={17} className="spin" />Finding a little clarity…</div>}<div ref={bottom} /></div>}<form className="chat-compose" onSubmit={event => { event.preventDefault(); void ask(input); }}><textarea aria-label="Ask your company handbook" placeholder="Ask a question about your company’s policies…" rows={2} value={input} onChange={event => setInput(event.target.value)} maxLength={3000} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(input); } }} /><Button type="submit" aria-label="Send policy question" loading={send.isPending} disabled={!input.trim()}>{!send.isPending && <Send size={18} />}</Button></form><p className="chat-caption">Sources included. If the handbook doesn’t cover it, I’ll say so.</p></Panel><aside className="stack ai-aside"><Panel className="ai-info-card"><BookOpen size={24} strokeWidth={1.5} /><h3>A little knowledge, close at hand.</h3><p>{sources.length ? `${sources.length} indexed ${sources.length === 1 ? 'policy is' : 'policies are'} ready to help.` : 'Your HR team can add and index company policies to make answers available.'}</p>{sources.map(source => <div key={source.id} className="row muted" style={{ marginBottom: 11, alignItems: 'flex-start', gap: 7 }}><FileText size={15} style={{ marginTop: 3 }} /><span>{source.title}</span></div>)}<Link href="/app/documents" className="text-link">Browse documents <ArrowUpRight size={15} /></Link></Panel><Panel className="ai-info-card"><ShieldCheck size={24} strokeWidth={1.5} /><h3>Helpful. Thoughtful. Grounded.</h3><ul><li>Answers come from your workspace’s company policies.</li><li>Private employee documents stay outside the handbook chat.</li><li>For anything the handbook doesn’t cover, your HR team is the best next step.</li></ul></Panel></aside></div>;
}
function BatchScreening() {
  const jobs = useApi<Job[]>('/jobs');
  const [jobId, setJobId] = useState('');
  const job = useApi<Job>(`/jobs/${jobId}`, !!jobId);
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, { score?: number; error?: string }>>({});
  const [current, setCurrent] = useState('');
  const query = useQueryClient();
  const candidates = job.data?.candidates?.filter(candidate => !['HIRED', 'REJECTED'].includes(candidate.stage)) ?? [];
  const run = async () => {
    if (running || !selected.length) return;
    setRunning(true); setResults({});
    let succeeded = 0;
    try { for (const candidateId of selected) { setCurrent(candidateId); try { const response = await api.post<{ score: number }>('/ai/screen-resume', { candidateId }); setResults(previous => ({ ...previous, [candidateId]: { score: response.data.score } })); succeeded++; } catch (error) { setResults(previous => ({ ...previous, [candidateId]: { error: errorMessage(error) } })); } } }
    finally { setCurrent(''); setRunning(false); await query.invalidateQueries({ queryKey: ['org'] }); if (succeeded) toast.success(`${succeeded} assessments saved for your review.`); else toast.error('No assessments were completed. Check the results and try again.'); }
  };
  return <Panel><PanelHeader title="A thoughtful first look" description="Screen up to 10 resumes against one role. Review each assessment before making a decision." /><div className="panel-body stack"><Field label="Choose a role"><select value={jobId} disabled={running} onChange={event => { setJobId(event.target.value); setSelected([]); setResults({}); }}><option value="">Select a role</option>{jobs.data?.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>{jobId && (job.isPending ? <Loading /> : job.error ? <ErrorState error={job.error} retry={() => void job.refetch()} /> : candidates.length ? <div className="stack-sm">{candidates.map(candidate => <label className="checkbox-field panel" key={candidate.id} style={{ padding: 15 }}><input type="checkbox" checked={selected.includes(candidate.id)} disabled={running || !selected.includes(candidate.id) && selected.length >= 10} onChange={event => setSelected(previous => event.target.checked ? [...previous, candidate.id] : previous.filter(id => id !== candidate.id))} /><span style={{ flex: 1 }}><strong>{candidate.name}</strong><small>{candidate.email}{!candidate.resumeText && ' · Add a resume from the candidate profile if needed.'}</small>{results[candidate.id]?.error && <span className="field-error">{results[candidate.id].error}</span>}</span>{current === candidate.id ? <LoaderCircle className="spin" size={18} /> : results[candidate.id]?.score !== undefined ? <span className="score"><Sparkles size={14} />{results[candidate.id].score}/100</span> : candidate.aiScore !== null ? <span className="muted">{candidate.aiScore}/100</span> : null}</label>)}</div> : <EmptyState title="No active candidates for this role." description="Add a candidate in recruiting to get started." />)}<div className="between wrap"><p className="field-hint">Skill evidence only. Hiring decisions stay with people.</p><Button onClick={() => void run()} loading={running} disabled={!selected.length}><Sparkles size={16} />Screen {selected.length || ''} {selected.length === 1 ? 'resume' : 'resumes'}</Button></div></div></Panel>;
}
export function Copilot() {
  const { data: session } = useSession();
  const status = useApi<{ available: boolean }>('/ai/status');
  const [tab, setTab] = useState('chat');
  return <><PageHeader title="A little help. A lot more possibility." description="Your thoughtful second hand for policies, hiring and everyday people work." action={<Badge value={status.data?.available ? 'READY' : 'PENDING'}>{status.data?.available ? 'Copilot ready' : status.isFetching ? 'Connecting' : 'AI connection unavailable'}</Badge>} /><Tabs value={tab} onChange={setTab} tabs={[{ value: 'chat', label: 'Ask your handbook' }, ...(canRecruit(session?.role) ? [{ value: 'jd', label: 'Job description writer' }, { value: 'screen', label: 'Resume screening' }] : [])]} />{tab === 'chat' ? <PolicyChat /> : tab === 'jd' ? <Panel><PanelHeader title="The right words for the right role" description="Turn a few thoughtful details into an inclusive starting point." /><div className="panel-body"><JdGenerator /></div></Panel> : <BatchScreening />}</>;
}
