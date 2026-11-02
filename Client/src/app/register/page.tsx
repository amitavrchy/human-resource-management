import { Suspense } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { Loading } from '@/components/ui/core';
export const metadata = { title: 'Create a workspace' };
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthForm registerMode />
    </Suspense>
  );
}
