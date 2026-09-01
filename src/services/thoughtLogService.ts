import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ThoughtLogMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  pe?: number;
  operatingMargins?: number;
  debtToEquity?: number;
}

export interface ThoughtLogRecord {
  id: string;
  title: string;
  content: string;
  folder?: string | null;
  tags: string | null;
  symbols: string | null;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MACRO' | 'CAUTION' | string;
  isPinned: boolean;
  agentOutput: string | null;
  agentActionType: string | null;
  agentHistory: string | null;
  marketDataJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItemStats {
  name: string;
  count: number;
}

export interface ThoughtLogFoldersResponse {
  totalCount: number;
  unfiledCount: number;
  telegramCount: number;
  voiceCount: number;
  folders: FolderItemStats[];
}

export type AgentActionType =
  | 'ADD_CONTEXT'
  | 'CHECK_ASSUMPTIONS'
  | 'RESEARCH_FURTHER'
  | 'ORGANIZE_THESIS'
  | 'PROPOSE_STRUCTURES'
  | 'CUSTOM_QUERY';

export interface RunAgentPayload {
  logId?: string;
  title: string;
  content: string;
  actionType: AgentActionType;
  customPrompt?: string;
  sentiment?: string;
  tags?: string[];
  saveToLog?: boolean;
}

export interface RunAgentResponse {
  markdownOutput: string;
  actionType: AgentActionType;
  detectedSymbols: string[];
  marketData: ThoughtLogMarketData[];
  suggestedTags: string[];
  refinedTitle?: string;
}

const COMMON_WORDS_SET = new Set([
  'AM', 'PM', 'EST', 'EDT', 'PST', 'PDT', 'CST', 'CDT', 'UTC', 'GMT',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'TODAY', 'WEEK', 'MONTH', 'YEAR', 'TIME', 'DATE', 'HOUR', 'MIN', 'SEC', 'DAILY',
  'IS', 'IT', 'AT', 'ON', 'IN', 'TO', 'IF', 'DO', 'GO', 'NO', 'SO', 'UP', 'MY', 'BY',
  'OR', 'AS', 'HE', 'WE', 'ME', 'US', 'OK', 'AN', 'BE', 'OF', 'THE', 'AND', 'FOR',
  'NOT', 'BUT', 'ALL', 'ANY', 'CAN', 'SEE', 'GET', 'SET', 'PUT', 'RUN', 'LET', 'DID',
  'NOW', 'OUT', 'OFF', 'WHY', 'HOW', 'WHO', 'YOU', 'HIS', 'HER', 'OUR', 'ITS', 'LOT',
  'FEW', 'WAY', 'END', 'OLD', 'NEW', 'BIG', 'TOP', 'LOW', 'BAD', 'BOY', 'MAN', 'JOB',
  'KEY', 'PAY', 'BUY', 'HIT', 'TRY', 'ASK', 'OWN', 'TOO', 'YES', 'DIP', 'MID', 'MAX', 'MIN',
  'WITH', 'FROM', 'THIS', 'THAT', 'HAVE', 'WILL', 'WHAT', 'WHEN', 'THEN', 'SOME',
  'JUST', 'MORE', 'VERY', 'MUCH', 'OVER', 'INTO', 'BEEN', 'LIKE', 'THEY', 'THEIR',
  'ABOUT', 'AFTER', 'BEFORE', 'COULD', 'WOULD', 'SHOULD', 'WHICH', 'WHERE', 'THESE',
  'THOSE', 'BECAUSE', 'HERE', 'THERE', 'EACH', 'BOTH', 'MANY', 'SUCH', 'EVEN', 'MOST',
  'ALSO', 'BACK', 'WELL', 'ONLY', 'DOWN', 'REAL', 'GOOD', 'BEST', 'LONG', 'SHORT',
  'OPEN', 'STOP', 'RISK', 'SELL', 'CASH', 'LOSS', 'GAIN', 'DROP', 'PUMP', 'DUMP',
  'HOLD', 'FEEL', 'LOOK', 'SEEM', 'TAKE', 'MAKE', 'KNOW', 'CALL', 'PUTS', 'TRADE',
  'TRADES', 'IDEA', 'IDEAS', 'WATCH', 'PRICE', 'LEVEL', 'MONEY', 'RALLY',
  'PE', 'EPS', 'FCF', 'ROE', 'ROIC', 'ROA', 'EBITDA', 'EBIT', 'NAV', 'CAGR',
  'CPI', 'PPI', 'GDP', 'PMI', 'VIX', 'DXY', 'YTD', 'MTD', 'QOQ', 'YOY',
  'DTE', 'ATM', 'OTM', 'ITM', 'IVR', 'IV', 'HV', 'OI', 'VOL',
  'AI', 'SAAS', 'EV', 'GPU', 'CPU', 'SMR', 'CEO', 'CFO', 'CTO', 'COO', 'CIO',
  'IPO', 'LLC', 'INC', 'CORP', 'LTD', 'PDF', 'URL', 'API', 'APP', 'BOT', 'MSG', 'SMS',
  'LOG', 'NOTE', 'POST', 'TEXT', 'SYNC', 'EDIT', 'VIEW', 'CHART', 'GRAPH'
]);

export interface ParsedAlertCandidate {
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW' | 'AUTO';
  rawSnippet: string;
}

export function extractPriceAlertCandidates(text: string): ParsedAlertCandidate[] {
  if (!text || typeof text !== 'string') return [];

  const sanitized = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/gi, ' ');
  const results: ParsedAlertCandidate[] = [];
  const seenSymbols = new Set<string>();

  const segments = sanitized.split(/[\r\n,;]+/);

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/(?:(?:SET\s+)?ALERT(?:\s+FOR|\s+ON|:)?\s+)?(?:\$)?([A-Za-z]{1,6})\s*(?:@|AT|:|ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP|REACH)?\s*\$?([0-9]+(?:\.[0-9]+)?)(?:\s*(?:ABOVE|BELOW|>|<|OVER|UNDER|DIP|DROP))?/i);

    if (match) {
      const rawSym = match[1].toUpperCase();
      const rawPrice = parseFloat(match[2]);

      if (
        !COMMON_WORDS_SET.has(rawSym) &&
        !isNaN(rawPrice) &&
        rawPrice > 0 &&
        rawSym.length >= 1 &&
        rawSym.length <= 6
      ) {
        let condition: 'ABOVE' | 'BELOW' | 'AUTO' = 'AUTO';
        const upperSeg = trimmed.toUpperCase();

        if (
          upperSeg.includes('BELOW') ||
          upperSeg.includes('<') ||
          upperSeg.includes('UNDER') ||
          upperSeg.includes('DIP') ||
          upperSeg.includes('DROP')
        ) {
          condition = 'BELOW';
        } else if (
          upperSeg.includes('ABOVE') ||
          upperSeg.includes('>') ||
          upperSeg.includes('OVER') ||
          upperSeg.includes('BREAKOUT') ||
          upperSeg.includes('REACH')
        ) {
          condition = 'ABOVE';
        }

        const dedupKey = `${rawSym}-${rawPrice}-${condition}`;
        if (!seenSymbols.has(dedupKey)) {
          seenSymbols.add(dedupKey);
          results.push({
            symbol: rawSym,
            targetPrice: rawPrice,
            condition,
            rawSnippet: trimmed,
          });
        }
      }
    }
  }

  return results;
}

export function extractSymbolsFromText(text: string): string[] {
  if (!text) return [];
  const sanitizedText = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/gi, ' ');
  const dollarMatches = (sanitizedText.match(/\$([A-Z]{1,6})\b/g) || []).map((s) => s.replace('$', '').toUpperCase());
  const wordMatches = (sanitizedText.match(/\b[A-Z]{2,5}\b/g) || []).map((s) => s.toUpperCase());
  const candidates = [...dollarMatches, ...wordMatches.filter((w) => !COMMON_WORDS_SET.has(w))];
  return Array.from(new Set(candidates)).slice(0, 8);
}

const API_BASE = '/api/thought-logs';

export async function fetchThoughtLogs(filters?: {
  search?: string;
  tag?: string;
  sentiment?: string;
  folder?: string;
}): Promise<ThoughtLogRecord[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.tag) params.append('tag', filters.tag);
  if (filters?.sentiment && filters.sentiment !== 'ALL') params.append('sentiment', filters.sentiment);
  if (filters?.folder) params.append('folder', filters.folder);

  const url = `${API_BASE}${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch thought logs');
  }
  return res.json();
}

export async function fetchThoughtLogFolders(): Promise<ThoughtLogFoldersResponse> {
  const res = await fetch(`${API_BASE}/folders`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch thought log folders');
  }
  return res.json();
}

export async function fetchThoughtLogById(id: string): Promise<ThoughtLogRecord> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch thought log');
  }
  return res.json();
}

export async function createThoughtLog(data: Partial<ThoughtLogRecord>): Promise<ThoughtLogRecord> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create thought log');
  }
  return res.json();
}

export async function updateThoughtLog(id: string, data: Partial<ThoughtLogRecord>): Promise<ThoughtLogRecord> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update thought log');
  }
  return res.json();
}

export async function bulkMoveThoughtLogs(params: { ids: string[]; folder: string }): Promise<{ success: boolean; count: number; folder: string }> {
  const res = await fetch(`${API_BASE}/bulk-move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to bulk move thought logs');
  }
  return res.json();
}

export async function deleteThoughtLog(id: string): Promise<{ success: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete thought log');
  }
  return res.json();
}

export async function runThoughtAgent(payload: RunAgentPayload): Promise<RunAgentResponse> {
  const res = await fetch(`${API_BASE}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Agent execution failed');
  }
  return res.json();
}

// React Query Hooks

export function useThoughtLogs(filters?: { search?: string; tag?: string; sentiment?: string; folder?: string }) {
  return useQuery({
    queryKey: ['thoughtLogs', filters],
    queryFn: () => fetchThoughtLogs(filters),
    staleTime: 10 * 1000,
  });
}

export function useThoughtLogFolders() {
  return useQuery({
    queryKey: ['thoughtLogFolders'],
    queryFn: () => fetchThoughtLogFolders(),
    staleTime: 10 * 1000,
  });
}

export function useThoughtLog(id?: string | null) {
  return useQuery({
    queryKey: ['thoughtLog', id],
    queryFn: () => fetchThoughtLogById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateThoughtLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ThoughtLogRecord>) => createThoughtLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thoughtLogs'] });
      queryClient.invalidateQueries({ queryKey: ['thoughtLogFolders'] });
    },
  });
}

export function useUpdateThoughtLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ThoughtLogRecord> }) =>
      updateThoughtLog(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['thoughtLogs'] });
      queryClient.invalidateQueries({ queryKey: ['thoughtLogFolders'] });
      queryClient.invalidateQueries({ queryKey: ['thoughtLog', data.id] });
    },
  });
}

export function useBulkMoveThoughtLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { ids: string[]; folder: string }) => bulkMoveThoughtLogs(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thoughtLogs'] });
      queryClient.invalidateQueries({ queryKey: ['thoughtLogFolders'] });
    },
  });
}

export function useDeleteThoughtLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteThoughtLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thoughtLogs'] });
      queryClient.invalidateQueries({ queryKey: ['thoughtLogFolders'] });
    },
  });
}

export function useRunThoughtAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RunAgentPayload) => runThoughtAgent(payload),
    onSuccess: (data, variables) => {
      if (variables.logId) {
        queryClient.invalidateQueries({ queryKey: ['thoughtLogs'] });
        queryClient.invalidateQueries({ queryKey: ['thoughtLog', variables.logId] });
      }
    },
  });
}

// Telegram Buffer API
export interface TelegramBufferSyncResult {
  success: boolean;
  consumedCount: number;
  createdLogs: Array<{ id: string; title: string; symbols: string | null }>;
  message?: string;
  timestamp: string;
}

export async function syncTelegramBuffer(): Promise<TelegramBufferSyncResult> {
  const res = await fetch('/api/telegram/sync-buffer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to sync Telegram buffer');
  }
  return res.json();
}

export function useTelegramBufferSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncTelegramBuffer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['telegramStatus'] });
      if (data.consumedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['thoughtLogs'] });
      }
    },
  });
}

export interface TelegramStatusResponse {
  isConfigured: boolean;
  bufferUrl: string | null;
  lastSyncTimestamp: string | null;
  lastSyncCount: number;
}

export async function fetchTelegramStatus(): Promise<TelegramStatusResponse> {
  const res = await fetch('/api/telegram/status');
  if (!res.ok) throw new Error('Failed to fetch Telegram status');
  return res.json();
}

export function useTelegramBufferStatus() {
  return useQuery({
    queryKey: ['telegramStatus'],
    queryFn: fetchTelegramStatus,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}
