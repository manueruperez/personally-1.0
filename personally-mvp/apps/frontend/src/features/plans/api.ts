import { api } from '@/lib/api';

export type PlanStatus = 'draft' | 'active' | 'archived';
export type WeekPhase = 'load' | 'deload' | 'test' | 'custom';
export type BlockType = 'warmup' | 'exercise' | 'cooldown';

export interface PlanSummaryDto {
  id: string;
  clientId: string;
  name: string;
  goal: string | null;
  daysPerWeek: number;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PlanItemDto {
  id: string;
  block: BlockType;
  orderIndex: number;
  exerciseId: string;
  exercise: { id: string; nameEs: string; imageUrl: string | null };
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  rpeTarget: number | null;
  cues: string | null;
  notes: string | null;
  loadSuggestion: string | null;
}

export interface PlanDayDto {
  id: string;
  dayOfWeek: number;
  focus: string | null;
  estimatedDurationMin: number | null;
  isRestDay: boolean;
  notes: string | null;
  items: PlanItemDto[];
}

export interface PlanWeekDto {
  id: string;
  weekNumber: number;
  phase: WeekPhase;
  notes: string | null;
  days: PlanDayDto[];
}

export interface PlanDto extends PlanSummaryDto {
  client?: { id: string; name: string; phone: string };
  weeks: PlanWeekDto[];
}

export interface CreatePlanDraftPayload {
  name: string;
  goal?: string;
  daysPerWeek: number;
  startDate: string;
  endDate: string;
  totalWeeks?: number;
}

export interface ImportCsvSummary {
  daysCreated: number;
  itemsCreated: number;
  exercisesCreated: number;
  exercisesReused: number;
  rowsSkipped: number;
  warnings: string[];
}

export const plansApi = {
  listByClient: (clientId: string) =>
    api.get<PlanSummaryDto[]>(`/api/v1/plans/by-client/${clientId}`),
  get: (id: string) => api.get<PlanDto>(`/api/v1/plans/${id}`),
  createDraft: (clientId: string, body: CreatePlanDraftPayload) =>
    api.post<PlanSummaryDto>(`/api/v1/plans/by-client/${clientId}`, body),
  activate: (id: string) => api.post<PlanSummaryDto>(`/api/v1/plans/${id}/activate`, {}),
  revertToDraft: (id: string) =>
    api.post<PlanSummaryDto>(`/api/v1/plans/${id}/revert-to-draft`, {}),
  archive: (id: string) => api.post<PlanSummaryDto>(`/api/v1/plans/${id}/archive`, {}),
  importCsv: (id: string, csv: string) =>
    api.post<ImportCsvSummary>(`/api/v1/plans/${id}/import-csv`, { csv }),
  deleteWeek: (id: string, weekNumber: number) =>
    api.delete<{ deletedWeekNumber: number }>(`/api/v1/plans/${id}/weeks/${weekNumber}`),
  addWeek: (id: string) =>
    api.post<{ id: string; weekNumber: number }>(`/api/v1/plans/${id}/weeks`, {}),
  updateItem: (itemId: string, body: UpdatePlanItemPayload) =>
    api.patch<PlanItemDto>(`/api/v1/plans/items/${itemId}`, body),
  addItem: (dayId: string, body: AddPlanItemPayload) =>
    api.post<PlanItemDto>(`/api/v1/plans/days/${dayId}/items`, body),
  deleteItem: (itemId: string) =>
    api.delete<{ deleted: boolean }>(`/api/v1/plans/items/${itemId}`),
};

export interface AddPlanItemPayload {
  exerciseId: string;
  block: 'warmup' | 'exercise' | 'cooldown';
  sets?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
  rpeTarget?: number | null;
  cues?: string | null;
  notes?: string | null;
}

export interface UpdatePlanItemPayload {
  exerciseId?: string;
  sets?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
  rpeTarget?: number | null;
  cues?: string | null;
  notes?: string | null;
  loadSuggestion?: string | null;
}
