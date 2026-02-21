import { requestData } from '@/lib/api-base';

export interface StatisticsOverview {
  totalTickets: number;
  byStatus: Array<{ key: string; count: number }>;
  byPriority: Array<{ key: string; count: number }>;
  byChannel: Array<{ key: string; count: number }>;
  trend: {
    created: Record<string, number>;
    closed: Record<string, number>;
  };
  sla: {
    averageResolutionHours: number | null;
  };
  costs: {
    itemCount: number;
    netTotal: number | string;
    vatTotal: number | string;
    grossTotal: number | string;
  };
}

export async function getStatisticsOverview(query: {
  from?: string;
  to?: string;
  assignedAgentId?: string;
  channel?: string;
  priority?: string;
  status?: string;
} = {}): Promise<StatisticsOverview> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestData<StatisticsOverview>(`/api/v1/statistics/overview${suffix}`);
}
