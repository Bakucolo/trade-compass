import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ExecutionReminder {
  id: string;
  symbol: string;
  task: string;
  remindAt: string;
  status: 'PENDING' | 'TRIGGERED' | 'CANCELLED';
  chatId?: string | null;
  messageThreadId?: number | null;
  senderLabel?: string | null;
  sourceMessage?: string | null;
  notes?: string | null;
  triggeredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExecutionReminderInput {
  symbol?: string;
  task?: string;
  remindAt?: string;
  text?: string;
  notes?: string;
}

export const fetchExecutionReminders = async (
  status?: string,
  symbol?: string
): Promise<ExecutionReminder[]> => {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') params.append('status', status);
  if (symbol) params.append('symbol', symbol);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/management/execution-reminders${query}`);
  if (!res.ok) {
    throw new Error('Failed to fetch execution reminders');
  }
  return res.json();
};

export const createExecutionReminder = async (
  input: CreateExecutionReminderInput
): Promise<ExecutionReminder> => {
  const res = await fetch('/api/management/execution-reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create execution reminder' }));
    throw new Error(error.error || 'Failed to create execution reminder');
  }
  return res.json();
};

export const deleteExecutionReminder = async (id: string): Promise<{ count: number }> => {
  const res = await fetch(`/api/management/execution-reminders/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to cancel execution reminder' }));
    throw new Error(error.error || 'Failed to cancel execution reminder');
  }
  return res.json();
};

export function useExecutionReminders(status?: string, symbol?: string) {
  return useQuery({
    queryKey: ['executionReminders', status, symbol],
    queryFn: () => fetchExecutionReminders(status, symbol),
    refetchInterval: 10000,
  });
}

export function useCreateExecutionReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExecutionReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executionReminders'] });
    },
  });
}

export function useDeleteExecutionReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExecutionReminder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executionReminders'] });
    },
  });
}
