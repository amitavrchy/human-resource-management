import { Suspense } from 'react';
import { TimeOff } from '@/components/leave/time-off';
import { Loading } from '@/components/ui/core';
export default function Page() { return <Suspense fallback={<Loading />}><TimeOff /></Suspense>; }
