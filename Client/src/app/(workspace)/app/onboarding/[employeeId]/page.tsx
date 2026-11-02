import { OnboardingChecklist } from '@/components/onboarding/onboarding';
export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <OnboardingChecklist id={employeeId} />;
}
