import { useQuery } from '@tanstack/react-query';
import { agentApi } from './api';

export function useAgentStatus() {
  return useQuery({
    queryKey: ['agent', 'status'],
    queryFn: () => agentApi.status(),
    refetchInterval: 5_000,
  });
}
