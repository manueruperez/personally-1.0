import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  exercisesApi,
  type CreateExercisePayload,
  type SearchExercisesParams,
} from './api';

const KEY = ['exercises'] as const;

export function useSearchExercises(params: SearchExercisesParams) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => exercisesApi.search(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExercisePayload) => exercisesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
