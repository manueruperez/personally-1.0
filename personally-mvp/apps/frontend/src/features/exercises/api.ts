import { api } from '@/lib/api';

export type ExerciseSource = 'free_exercise_db' | 'custom' | 'exercisedb';

export interface ExerciseDto {
  id: string;
  source: ExerciseSource;
  nameEs: string;
  nameEn: string | null;
  muscleprimary: string[];
  muscleSecondary: string[];
  equipment: string[];
  level: string | null;
  mechanic: string | null;
  instructions: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  createdBy: string | null;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchExercisesResponse {
  data: ExerciseDto[];
  meta: { total: number; page: number; pageSize: number };
}

export interface SearchExercisesParams {
  q?: string;
  muscle?: string;
  equipment?: string;
  level?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateExercisePayload {
  nameEs: string;
  nameEn?: string;
  muscleprimary?: string[];
  muscleSecondary?: string[];
  equipment?: string[];
  level?: string;
  mechanic?: string;
  instructions?: string;
  imageUrl?: string;
  videoUrl?: string;
}

function buildQuery(params: SearchExercisesParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.muscle) qs.set('muscle', params.muscle);
  if (params.equipment) qs.set('equipment', params.equipment);
  if (params.level) qs.set('level', params.level);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const exercisesApi = {
  search: (params: SearchExercisesParams) =>
    fetchWithMeta<ExerciseDto[]>(`/api/v1/exercises${buildQuery(params)}`),
  get: (id: string) => api.get<ExerciseDto>(`/api/v1/exercises/${id}`),
  create: (body: CreateExercisePayload) => api.post<ExerciseDto>('/api/v1/exercises', body),
};

// api.ts's helper solo devuelve `data`. Para listas necesitamos `meta` tambien.
async function fetchWithMeta<T>(path: string): Promise<{ data: T; meta: { total: number; page: number; pageSize: number } }> {
  const { supabase } = await import('@/lib/supabase');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? res.statusText);
  }
  return res.json();
}
