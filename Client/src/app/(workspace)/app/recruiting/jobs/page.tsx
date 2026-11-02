import { Suspense } from 'react';
import { Jobs } from '@/components/recruiting/jobs';
import { Loading } from '@/components/ui/core';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Jobs />
    </Suspense>
  );
}
