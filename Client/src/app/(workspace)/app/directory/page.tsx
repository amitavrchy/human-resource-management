import { Suspense } from 'react';
import { Directory } from '@/components/people/directory';
import { Loading } from '@/components/ui/core';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Directory />
    </Suspense>
  );
}
