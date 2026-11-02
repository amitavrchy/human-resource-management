'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile } from '@/lib/download';
import { errorMessage } from '@/lib/api';
import { Button } from './core';

export function DownloadButton({
  path,
  name,
  label = 'Download',
}: {
  path: string;
  name?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      await downloadFile(path, name);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="ghost" loading={loading} onClick={() => void download()}>
      <Download size={16} />
      {label}
    </Button>
  );
}
