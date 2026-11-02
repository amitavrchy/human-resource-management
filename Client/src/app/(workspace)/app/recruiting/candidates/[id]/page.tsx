import { CandidateProfile } from '@/components/recruiting/candidate-profile';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CandidateProfile id={id} />;
}
