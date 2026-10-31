import { EmployeeProfile } from '@/components/people/profile';
export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) { const { employeeId } = await params; return <EmployeeProfile id={employeeId} />; }
