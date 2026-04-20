import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentApi } from './api';

export function useAgentStatus() {
  return useQuery({
    queryKey: ['agent', 'status'],
    queryFn: () => agentApi.status(),
    refetchInterval: 5_000,
  });
}

export function useReconnectAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agentApi.reconnect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent', 'status'] });
    },
  });
}
