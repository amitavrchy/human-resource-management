'use client';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { makeStore } from '@/features/store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  const [query] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30000, refetchOnWindowFocus: true, retry: (count, error) => count < 1 && ![401, 403, 404].includes((error as { response?: { status?: number } }).response?.status ?? 0) }, mutations: { retry: false } } }));
  return <Provider store={store}><QueryClientProvider client={query}><MotionConfig reducedMotion="user">{children}<Toaster richColors position="bottom-right" closeButton toastOptions={{ style: { fontSize: 14, fontFamily: 'inherit' } }} /></MotionConfig></QueryClientProvider></Provider>;
}
