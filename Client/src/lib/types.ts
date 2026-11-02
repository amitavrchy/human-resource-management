export type Role = 'OWNER' | 'HR_ADMIN' | 'MANAGER' | 'RECRUITER' | 'EMPLOYEE';
export interface Session {
  user: { id: string; name: string; email: string };
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    workWeekdays: number[];
  };
  role: Role;
  employeeId: string | null;
  membershipId: string;
}
export interface Named {
  id: string;
  name: string;
}
export interface Location extends Named {
  country: string;
}
export interface Policy extends Named {
  code: string;
  annualDays: number;
}
export interface Task {
  id: string;
  employeeId: string;
  title: string;
  status: 'TODO' | 'DOING' | 'DONE' | 'BLOCKED';
  dueDate: string | null;
  sortOrder: number;
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName'>;
}
export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  title: string | null;
  departmentId: string | null;
  locationId: string | null;
  managerId: string | null;
  status: 'ACTIVE' | 'ONBOARDING' | 'LEAVE' | 'TERMINATED';
  startDate: string | null;
  endDate: string | null;
  avatarUrl: string | null;
  department: Named | null;
  location: Location | null;
  manager: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'title'> | null;
  personalEmail?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  customFields?: Record<string, string>;
  tasks?: Task[];
  onboardingTasks?: Task[];
  leaveHistory?: LeaveRequest[];
  documents?: Document[];
  privateAccess?: boolean;
}
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit?: number;
}
export interface Metadata {
  departments: Named[];
  locations: Location[];
  policies: Policy[];
  templates: {
    id: string;
    name: string;
    tasksJson: { title: string; sortOrder: number }[];
    isDefault: boolean;
  }[];
}
export interface Balance {
  id: string;
  policyId: string;
  year: number;
  balanceDays: number;
  pendingDays: number;
  policy: Policy;
}
export interface LeaveRequest {
  id: string;
  employeeId: string;
  policyId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'title' | 'department'>;
  policy: Policy;
}
export type Stage = 'APPLIED' | 'SCREEN' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
export interface Candidate {
  id: string;
  jobId: string;
  name: string;
  email: string;
  resumeText: string | null;
  stage: Stage;
  aiScore: number | null;
  aiSummary: string | null;
  aiReasonsJson: { reasons: string[]; missingSkills: string[] } | null;
  notes: string | null;
  feedbackJson: { comment: string; rating: number; authorUserId: string; createdAt: string }[];
  employeeId: string | null;
  createdAt: string;
  hasResume?: boolean;
  job?: Job;
}
export interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  hiringManagerId: string | null;
  descriptionMd: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  createdAt: string;
  _count?: { candidates: number };
  candidates?: Candidate[];
}
export interface Document {
  id: string;
  title: string;
  category: string;
  mimeType: string;
  size: number;
  isHandbook: boolean;
  ingestStatus: string;
  employeeId: string | null;
  employee?: { firstName: string; lastName: string } | null;
  createdAt: string;
}
export interface Goal {
  id: string;
  employeeId: string;
  title: string;
  progress: number;
  dueDate: string | null;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName'>;
}
export interface Review {
  id: string;
  quarter: string;
  achievements: string;
  improvements: string;
  rating: number;
  createdAt: string;
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName'>;
}
export interface Audit {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  metaJson?: Record<string, unknown> | null;
  createdAt: string;
}
export interface Dashboard {
  headcount: number;
  onboarding: number;
  pendingLeave: number;
  openJobs: number;
  tasks: Task[];
  activity: Audit[];
  upcomingLeave: LeaveRequest[];
  celebrations: { id: string; name: string; title: string | null; type: string; date: string }[];
  trend: { month: string; count: number }[];
  departments: { name: string; count: number }[];
  scope: string;
}
export interface HeadcountReport {
  total: number;
  departments: { name: string; count: number }[];
  locations: { name: string; count: number }[];
  months: { month: string; headcount: number; joiners: number; leavers: number }[];
}
export interface FunnelReport {
  stages: { stage: string; count: number }[];
  jobs: { id: string; title: string; total: number; hired: number; conversion: number }[];
}
export interface LeaveReport {
  year: number;
  policies: {
    name: string;
    used: number;
    allocated: number;
    utilization: number;
    pending: number;
  }[];
}
export interface Member {
  id: string;
  role: Role;
  user: { id: string; name: string; email: string };
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName'> | null;
}
export interface ChatReply {
  answer: string;
  citations: { id: string; documentId: string; title: string; excerpt: string }[];
}

export interface JobTemplate {
  id: string;
  name: string;
  title: string;
  department: string;
  descriptionMd: string;
}
