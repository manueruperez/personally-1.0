import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';

export function useDashboardToday() {
  return useQuery({
    queryKey: ['dashboard', 'today'],
    queryFn: () => dashboardApi.today(),
    refetchInterval: 10_000,
  });
}
