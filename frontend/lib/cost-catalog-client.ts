import { requestData } from '@/lib/api-base';

export interface CostCatalogItem {
  id: string;
  name: string;
  unitNet: number;
  vatCode: string;
  defaultQty: number;
  category?: string;
  unit?: string;
  active: boolean;
}

export async function listCostCatalog(): Promise<CostCatalogItem[]> {
  return requestData<CostCatalogItem[]>('/api/v1/settings/cost-catalog');
}

export async function saveCostCatalog(items: CostCatalogItem[]): Promise<CostCatalogItem[]> {
  return requestData<CostCatalogItem[]>('/api/v1/settings/cost-catalog', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}
