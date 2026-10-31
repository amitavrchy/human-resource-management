'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Bell, BriefcaseBusiness, ChartNoAxesCombined, CheckCheck, ChevronDown, Command, FileText, HelpCircle, House, LogOut, Menu, Moon, Network, Search, Settings2, ShieldCheck, Sparkles, Sun, Target, Users, Waves, X, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, isAdmin, label } from '@/lib/utils';
import { setCommandOpen, setOrganization, setSession, setSidebarOpen, setTheme, useAppDispatch, useAppSelector } from '@/features/store';
import { useApi, useSession } from '@/hooks/use-api';
import { Avatar, Button, ErrorState, Loading, Modal } from '@/components/ui/core';
import type { Dashboard, Role } from '@/lib/types';
import { CommandPalette } from './command-palette';

const allRoles: Role[] = ['OWNER', 'HR_ADMIN', 'MANAGER', 'RECRUITER', 'EMPLOYEE'];
export const navigation = [
  { href: '/app', title: 'Overview', icon: House, roles: allRoles },
  { href: '/app/directory', title: 'People', icon: Users, roles: allRoles },
  { href: '/app/org-chart', title: 'Org chart', icon: Network, roles: allRoles },
  { href: '/app/time-off', title: 'Time off', icon: CalendarDays, roles: allRoles },
  { href: '/app/recruiting/jobs', title: 'Recruiting', icon: BriefcaseBusiness, roles: ['OWNER', 'HR_ADMIN', 'MANAGER', 'RECRUITER'] },
  { href: '/app/onboarding', title: 'Onboarding', icon: CheckCheck, roles: allRoles },
  { href: '/app/documents', title: 'Documents', icon: FileText, roles: allRoles },
  { href: '/app/performance', title: 'Performance', icon: Target, roles: allRoles },
  { href: '/app/reports', title: 'Reports', icon: ChartNoAxesCombined, roles: ['OWNER', 'HR_ADMIN'] },
] as const;

export function Brand({ light }: { light?: boolean }) { return <Link href="/" className={cn('brand', light && 'brand-light')} aria-label="PeopleOS home"><span className="brand-icon"><Waves size={23} strokeWidth={2.5} /></span>people<span className="brand-os">OS</span><span className="brand-dot" /></Link>; }

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const query = useQueryClient();
  const dispatch = useAppDispatch();
  const session = useAppSelector(s => s.auth.session);
  const theme = useAppSelector(s => s.ui.theme);
  const dashboard = useApi<Dashboard>('/dashboard');
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  if (!session) return null;
  const close = () => dispatch(setSidebarOpen(false));
  const logout = async () => {
    setSigningOut(true); setLogoutError('');
    try { await api.post('/auth/logout'); query.clear(); dispatch(setSession(null)); dispatch(setOrganization(null)); router.replace('/login'); }
    catch { setLogoutError('Could not sign out. Try again.'); setSigningOut(false); }
  };
  const toggleTheme = () => { const next = theme === 'light' ? 'dark' : 'light'; dispatch(setTheme(next)); localStorage.setItem('peopleos-theme', next); document.documentElement.dataset.theme = next; };
  return <><div className="sidebar-brand"><Brand /></div><div className="workspace-chip"><span className="workspace-icon">{session.organization.name[0]}</span><div><strong>{session.organization.name}</strong><span>People workspace</span></div><ShieldCheck size={17} /></div><div className="nav-caption">WORKSPACE</div><nav className="sidebar-nav" aria-label="Main navigation">{navigation.filter(item => (item.roles as readonly string[]).includes(session.role)).map(item => { const active = item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href); return <Link onClick={close} key={item.href} href={item.href} className={cn('nav-item', active && 'active')} aria-current={active ? 'page' : undefined}><item.icon size={19} strokeWidth={1.7} /><span>{item.title}</span>{item.title === 'Time off' && isAdmin(session.role) && !!dashboard.data?.pendingLeave && <span className="nav-count">{dashboard.data.pendingLeave}</span>}</Link>; })}</nav><div className="nav-caption tools-caption">TOOLS</div><nav className="sidebar-nav" aria-label="Workspace tools"><Link onClick={close} href="/app/ai" className={cn('nav-item', pathname.startsWith('/app/ai') && 'active')}><Sparkles size={19} /><span>AI Copilot</span><span className="ai-pill">AI</span></Link><Link onClick={close} href="/app/settings" className={cn('nav-item', pathname.startsWith('/app/settings') && 'active')}><Settings2 size={19} /><span>Settings</span></Link></nav><div className="sidebar-bottom"><Link className="copilot-callout" href="/app/ai" onClick={close}><span className="copilot-mini-icon"><Sparkles size={18} /></span><strong>A little less busywork.</strong><span>Meet your people copilot <ArrowUpRight size={15} /></span></Link><Dropdown.Root><Dropdown.Trigger asChild><button className="user-button" aria-label="Open account menu"><Avatar name={session.user.name} /><span><strong>{session.user.name}</strong><small>{label(session.role)}</small></span><ChevronDown size={16} /></button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="dropdown" side="top" align="start" sideOffset={8}><Dropdown.Label className="dropdown-label">{session.user.email}</Dropdown.Label>{session.employeeId && <Dropdown.Item asChild><Link href={`/app/directory/${session.employeeId}`} onClick={close}>My profile</Link></Dropdown.Item>}<Dropdown.Item onSelect={toggleTheme}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}{theme === 'light' ? 'Dark appearance' : 'Light appearance'}</Dropdown.Item><Dropdown.Separator /><Dropdown.Item disabled={signingOut} onSelect={() => void logout()}><LogOut size={17} />{signingOut ? 'Signing out…' : 'Sign out'}</Dropdown.Item>{logoutError && <p role="alert" className="field-error">{logoutError}</p>}</Dropdown.Content></Dropdown.Portal></Dropdown.Root></div></>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useAppSelector(s => s.ui.sidebarOpen);
  const [help, setHelp] = useState(false);
  const reduced = useReducedMotion();
  const dashboard = useApi<Dashboard>('/dashboard');
  useEffect(() => { if (session.data) { dispatch(setSession(session.data)); dispatch(setOrganization(session.data.organization.id)); } }, [session.data, dispatch]);
  useEffect(() => { if ((session.error as { response?: { status?: number } } | null)?.response?.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [session.error, router, pathname]);
  useEffect(() => {
    const saved = localStorage.getItem('peopleos-theme');
    if (saved === 'dark' || saved === 'light') { document.documentElement.dataset.theme = saved; dispatch(setTheme(saved)); }
    const keyboard = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); dispatch(setCommandOpen(true)); } };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [dispatch]);
  useEffect(() => { dispatch(setSidebarOpen(false)); }, [pathname, dispatch]);
  if (session.isPending || !session.data && (session.error as { response?: { status?: number } } | null)?.response?.status === 401) return <Loading />;
  if (session.error) return <ErrorState error={session.error} retry={() => void session.refetch()} />;
  const current = [...navigation, { href: '/app/ai', title: 'AI Copilot' }, { href: '/app/settings', title: 'Settings' }].find(item => item.href !== '/app' && pathname.startsWith(item.href))?.title ?? 'Overview';
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><aside className="desktop-sidebar"><SidebarContent /></aside><Dialog.Root open={sidebarOpen} onOpenChange={open => dispatch(setSidebarOpen(open))}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="mobile-sidebar"><Dialog.Title className="sr-only">Workspace navigation</Dialog.Title><Dialog.Description className="sr-only">Navigate your PeopleOS workspace.</Dialog.Description><Dialog.Close className="mobile-close icon-button" aria-label="Close navigation"><X size={20} /></Dialog.Close><SidebarContent /></Dialog.Content></Dialog.Portal></Dialog.Root><div className="app-main"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => dispatch(setSidebarOpen(true))}><Menu size={22} /></button><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{current}</strong></div><div className="topbar-actions"><button className="global-search" onClick={() => dispatch(setCommandOpen(true))}><Search size={17} /><span>Search anything…</span><kbd><Command size={13} /> K</kbd></button><button className="icon-button mobile-search" aria-label="Search workspace" onClick={() => dispatch(setCommandOpen(true))}><Search size={20} /></button><button className="icon-button help-button" aria-label="Workspace help" onClick={() => setHelp(true)}><HelpCircle size={20} /></button><Dropdown.Root><Dropdown.Trigger asChild><button className="icon-button notification-trigger" aria-label="Open notifications"><Bell size={20} />{!!dashboard.data?.pendingLeave && <span />}</button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="dropdown notifications" align="end" sideOffset={12}><Dropdown.Label className="dropdown-label">Your workspace, at a glance</Dropdown.Label><Dropdown.Item asChild><Link href="/app/time-off"><CalendarDays size={18} /><span>{dashboard.data?.pendingLeave ?? 0} pending leave requests</span></Link></Dropdown.Item><Dropdown.Item asChild><Link href="/app/onboarding"><CheckCheck size={18} /><span>{dashboard.data?.onboarding ?? 0} people onboarding</span></Link></Dropdown.Item><Dropdown.Item asChild><Link href="/app/documents"><FileText size={18} />Browse company policies</Link></Dropdown.Item></Dropdown.Content></Dropdown.Portal></Dropdown.Root><span className="topbar-divider" /><Avatar name={session.data?.user.name ?? 'User'} size="sm" /></div></header><main id="main-content" tabIndex={-1} className="page-content"><AnimatePresence mode="wait" initial={false}><motion.div key={pathname} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }}>{children}</motion.div></AnimatePresence><footer className="app-footer"><span>Thoughtfully built for your people.</span><span><span className="status-dot" />PeopleOS</span></footer></main></div><CommandPalette /><Modal open={help} onOpenChange={setHelp} title="A little help, when you need it" description="Find people, keep things moving and make work a little better."><div className="help-links"><Link href="/app/ai" onClick={() => setHelp(false)}><Sparkles />Ask a question about company policy<ArrowUpRight /></Link><Link href="/app/documents" onClick={() => setHelp(false)}><FileText />Read your company handbook<ArrowUpRight /></Link><button onClick={() => { setHelp(false); dispatch(setCommandOpen(true)); }}><Search />Find a person or page<kbd>Ctrl K</kbd></button></div><div className="dialog-footer"><Button variant="secondary" onClick={() => setHelp(false)}>Got it</Button></div></Modal></div>;
}
