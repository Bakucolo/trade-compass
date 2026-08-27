import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface SendTelegramReportResult {
  success: boolean;
  filename: string;
  sizeBytes: number;
  messageId?: number;
  data: any;
}

export async function triggerSendTelegramReport(): Promise<SendTelegramReportResult> {
  const res = await fetch('/api/telegram/send-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to send report (HTTP ${res.status})`);
  }

  return res.json();
}

export function useSendTelegramReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerSendTelegramReport,
    onSuccess: (data) => {
      toast.success('Executive PDF Delivered to Telegram!', {
        description: `Generated ${data.filename} (${(data.sizeBytes / 1024).toFixed(1)} KB) and uploaded to your phone.`,
      });
      queryClient.invalidateQueries({ queryKey: ['telegramStatus'] });
      queryClient.invalidateQueries({ queryKey: ['agentActivities'] });
    },
    onError: (err: any) => {
      toast.error('Telegram Report Dispatch Failed', {
        description: err.message || 'Please check your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local.',
      });
    },
  });
}
