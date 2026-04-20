import { useQuery } from '@tanstack/react-query';
import { messagesApi } from './api';

export function useClientMessages(clientId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['messages', 'by-client', clientId, limit],
    queryFn: () => messagesApi.listByClient(clientId!, limit),
    enabled: !!clientId,
    refetchInterval: 5_000,
  });
}
