import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  plansApi,
  type AddPlanItemPayload,
  type CreatePlanDraftPayload,
  type UpdatePlanItemPayload,
} from './api';

const KEY = ['plans'] as const;

export function usePlansByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'by-client', clientId],
    queryFn: () => plansApi.listByClient(clientId!),
    enabled: !!clientId,
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => plansApi.get(id!),
    enabled: !!id,
  });
}

export function useCreatePlanDraft(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePlanDraftPayload) => plansApi.createDraft(clientId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, 'by-client', clientId] });
    },
  });
}

export function useActivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansApi.activate(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, data.id] });
    },
  });
}

export function useRevertPlanToDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansApi.revertToDraft(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, data.id] });
    },
  });
}

export function useArchivePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plansApi.archive(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, data.id] });
    },
  });
}

export function useImportPlanCsv(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => plansApi.importCsv(planId, csv),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, planId] });
    },
  });
}

export function useDeletePlanWeek(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekNumber: number) => plansApi.deleteWeek(planId, weekNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, planId] });
    },
  });
}

export function useAddPlanWeek(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => plansApi.addWeek(planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, planId] });
    },
  });
}

export function useUpdatePlanItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: UpdatePlanItemPayload }) =>
      plansApi.updateItem(itemId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, planId] });
    },
  });
}

export function useAddPlanItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, body }: { dayId: string; body: AddPlanItemPayload }) =>
      plansApi.addItem(dayId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, planId] });
    },
  });
}

export function useDeletePlanItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => plansApi.deleteItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, planId] });
    },
  });
}
