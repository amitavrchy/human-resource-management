import { api } from './api';
export async function downloadFile(path: string, filename?: string) {
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  const disposition = String(response.headers['content-disposition'] ?? '');
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const suggested = disposition.match(/filename="([^"]+)"/i)?.[1];
  link.href = url;
  link.download = filename ?? (encoded ? decodeURIComponent(encoded) : suggested) ?? 'document';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
