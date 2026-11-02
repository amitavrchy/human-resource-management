import { JobPipeline } from '@/components/recruiting/pipeline';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobPipeline id={id} />;
}
