import { requestData } from '@/lib/api-base';

export interface ReminderItem {
  id: string;
  ticketId: string | null;
  title: string;
  note: string;
  dueAt: string;
  status: 'PENDING' | 'DONE';
  createdAt: string;
  createdBy: string | null;
  completedAt: string | null;
}

export async function listReminders(query: {
  ticketId?: string;
  includeDone?: boolean;
} = {}): Promise<ReminderItem[]> {
  const params = new URLSearchParams();
  if (query.ticketId) params.set('ticketId', query.ticketId);
  if (query.includeDone) params.set('includeDone', '1');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestData(`/api/v1/reminders${suffix}`);
}

export async function createReminder(payload: {
  ticketId?: string;
  title: string;
  note?: string;
  dueAt: string;
}): Promise<ReminderItem> {
  return requestData('/api/v1/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markReminderDone(id: string, done: boolean): Promise<ReminderItem> {
  return requestData(`/api/v1/reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
  });
}

export async function deleteReminder(id: string): Promise<{ deleted: boolean }> {
  return requestData(`/api/v1/reminders/${id}`, {
    method: 'DELETE',
  });
}
