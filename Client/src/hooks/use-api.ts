'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAppSelector } from '@/features/store';
import type { Session } from '@/lib/types';
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => (await api.get<Session>('/me')).data,
    retry: false,
    staleTime: 60000,
  });
}
export function useApi<T>(path: string, enabled = true) {
  const orgId = useAppSelector((state) => state.org.id);
  return useQuery({
    queryKey: ['org', orgId, path],
    queryFn: async () => (await api.get<T>(path)).data,
    enabled: enabled && !!orgId,
  });
}
export function useAction<TData = unknown, TVariables = unknown>(
  action: (values: TVariables) => Promise<TData>,
  options?: { success?: string; onSuccess?: (data: TData) => void },
) {
  const query = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: async (data) => {
      await query.invalidateQueries({ queryKey: ['org'] });
      if (options?.success) toast.success(options.success);
      options?.onSuccess?.(data);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
