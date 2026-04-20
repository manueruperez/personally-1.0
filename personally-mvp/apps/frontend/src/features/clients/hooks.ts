import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clientsApi,
  type ClientStatusFilter,
  type CreateClientPayload,
  type UpdateClientPayload,
} from './api';

const KEY = ['clients'] as const;

export function useClients(status: ClientStatusFilter = 'active') {
  return useQuery({
    queryKey: [...KEY, { status }],
    queryFn: () => clientsApi.list(status),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => clientsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClientPayload) => clientsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClientPayload) => clientsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, id] });
    },
  });
}

export function useArchiveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.archive(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, id] });
    },
  });
}

export function useSendTestMessage(clientId: string) {
  return useMutation({
    mutationFn: (text: string) => clientsApi.sendTestMessage(clientId, text),
  });
}

export function useTodaySession(clientId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, clientId, 'today-session'],
    queryFn: () => clientsApi.todaySession(clientId!),
    enabled: !!clientId,
    refetchInterval: 10_000,
  });
}

export function useResetTodaySession(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => clientsApi.resetTodaySession(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', 'by-client', clientId] });
      qc.invalidateQueries({ queryKey: [...KEY, clientId, 'today-session'] });
    },
  });
}

export function useSendDailyGreeting(clientId: string) {
  return useMutation({
    mutationFn: () => clientsApi.sendDailyGreeting(clientId),
  });
}
