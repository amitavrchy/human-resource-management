import { api } from './api';
export async function downloadFile(path: string, filename: string) {
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
