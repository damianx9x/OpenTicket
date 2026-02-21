import { requestData } from '@/lib/api-base';

export interface TicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  storageProvider?: string;
  uploader?: {
    id?: string;
    name?: string | null;
  } | null;
}

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  return requestData<TicketAttachment[]>(`/api/v1/tickets/${ticketId}/attachments`);
}

export async function uploadAttachment(ticketId: string, file: File): Promise<{
  attachment: TicketAttachment;
  downloadUrl?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  return requestData(`/api/v1/tickets/${ticketId}/attachments/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteAttachment(attachmentId: string): Promise<{ deleted: boolean }> {
  return requestData(`/api/v1/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

export function getAttachmentFileUrl(attachmentId: string): string {
  return `/api/v1/attachments/${attachmentId}/file`;
}
