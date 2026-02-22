import { requestData, requestEnvelope, type ApiMeta } from '@/lib/api-base';

export type TicketStatus =
  | 'RECEIVED'
  | 'DIAGNOSIS'
  | 'QUOTE_READY'
  | 'PARTS_ORDERED'
  | 'WAITING_FOR_APPROVAL'
  | 'SENT_TO_CUSTOMER'
  // Legacy statuses kept for backward compatibility with old datasets
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'ARCHIVED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketChannel = 'APP' | 'WEB_FORM' | 'EMAIL' | 'DROP_OFF';

export interface TicketListMeta extends ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface TicketOwner {
  id: string;
  name: string | null;
  email: string;
}

export interface TicketSummary {
  id: string;
  number: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  ownerUserId: string;
  assignedAgentId?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: TicketOwner;
  assignedAgent?: TicketOwner | null;
}

export interface TicketStatusHistoryEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  user?: {
    id: string;
    name?: string | null;
  } | null;
}

export interface TicketDetail extends TicketSummary {
  statusHistory: TicketStatusHistoryEntry[];
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority?: TicketPriority;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  deviceType?: string;
  serialNumber?: string;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAgentId?: string | null;
  assignedTo?: string;
}

export interface TicketQuery {
  page?: number;
  limit?: number;
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  channel?: TicketChannel | '';
  assignedAgentId?: string;
  assignedState?: 'assigned' | 'unassigned' | '';
  search?: string;
  onlyMine?: boolean;
  minAgeDays?: number;
  hasAttachments?: boolean;
  hasComments?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sort?:
    | 'createdAt_asc'
    | 'createdAt_desc'
    | 'updatedAt_asc'
    | 'updatedAt_desc'
    | 'priority_asc'
    | 'priority_desc'
    | 'number_asc'
    | 'number_desc'
    | 'status_asc'
    | 'status_desc';
}

export interface CustomerHistoryItem {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  assignedAgentId?: string | null;
  assignedAgent?: TicketOwner | null;
}

export interface CustomerHistoryResponse {
  ownerUserId: string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
    phone?: string | null;
  };
  ticketCount: number;
  items: CustomerHistoryItem[];
}

export interface CommentItem {
  id: string;
  ticketId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author?: {
    id: string;
    name?: string | null;
    email?: string;
  };
}

export interface CreateCommentInput {
  body: string;
  isInternal?: boolean;
  author?: string;
}

export interface CostItem {
  id: string;
  ticketId: string;
  name: string;
  qty: string | number;
  unitNet: string | number;
  vatCode: string;
  netTotal: string | number;
  vatTotal: string | number;
  grossTotal: string | number;
  createdAt: string;
}

export interface CostSummary {
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  itemCount: number;
}

export interface CostListResponse {
  items: CostItem[];
  summary: CostSummary;
}

export interface CreateCostItemInput {
  name: string;
  qty: number;
  unitNet: number;
  vatCode: string;
}

function normalizeQuery(query: TicketQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  if (query.channel) params.set('channel', query.channel);
  if (query.assignedAgentId) params.set('assignedAgentId', query.assignedAgentId);
  if (query.assignedState) params.set('assignedState', query.assignedState);
  if (query.onlyMine) params.set('onlyMine', '1');
  if (query.minAgeDays && query.minAgeDays > 0) params.set('minAgeDays', String(Math.floor(query.minAgeDays)));
  if (typeof query.hasAttachments === 'boolean') params.set('hasAttachments', query.hasAttachments ? '1' : '0');
  if (typeof query.hasComments === 'boolean') params.set('hasComments', query.hasComments ? '1' : '0');
  if (query.createdFrom) params.set('createdFrom', query.createdFrom);
  if (query.createdTo) params.set('createdTo', query.createdTo);
  if (query.sort) params.set('sort', query.sort);

  return params;
}

export async function listTickets(query: TicketQuery = {}): Promise<{ items: TicketSummary[]; meta: TicketListMeta }> {
  const params = normalizeQuery(query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const envelope = await requestEnvelope<TicketSummary[]>(`/api/v1/tickets${suffix}`);

  return {
    items: envelope.data,
    meta: (envelope.meta as TicketListMeta | undefined) ?? {},
  };
}

export async function createTicket(input: CreateTicketInput): Promise<TicketSummary> {
  return requestData<TicketSummary>('/api/v1/tickets', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      priority: input.priority ?? 'NORMAL',
    }),
  });
}

export async function updateTicket(ticketId: string, input: UpdateTicketInput): Promise<TicketSummary> {
  return requestData<TicketSummary>(`/api/v1/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function getCustomerHistory(ticketId: string, limit = 10): Promise<CustomerHistoryResponse> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 50)) : 10;
  return requestData<CustomerHistoryResponse>(`/api/v1/tickets/${ticketId}/customer-history?limit=${normalizedLimit}`);
}

export async function getTicketDetails(ticketId: string): Promise<TicketDetail> {
  return requestData<TicketDetail>(`/api/v1/tickets/${ticketId}`);
}

export async function listComments(ticketId: string): Promise<CommentItem[]> {
  return requestData<CommentItem[]>(`/api/v1/tickets/${ticketId}/comments`);
}

export async function addComment(ticketId: string, input: CreateCommentInput): Promise<CommentItem> {
  return requestData<CommentItem>(`/api/v1/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listCostItems(ticketId: string): Promise<CostListResponse> {
  return requestData<CostListResponse>(`/api/v1/tickets/${ticketId}/cost-items`);
}

export async function addCostItem(ticketId: string, input: CreateCostItemInput): Promise<CostItem> {
  return requestData<CostItem>(`/api/v1/tickets/${ticketId}/cost-items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function asNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
