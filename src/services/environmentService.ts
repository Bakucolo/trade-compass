import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type HostingMode = 'cloud' | 'local';

export interface HostingFeatures {
  cloudLLM: boolean;
  gemini: boolean;
  groq: boolean;
  openrouter: boolean;
  tastytradeCloud: boolean;
  trading212Cloud: boolean;
  telegramHub: boolean;
  marketDataCloud: boolean;
  vectorChartsPdf: boolean;
  // Localhost-only features:
  ollamaLocal: boolean;
  pythonLangGraphLocal: boolean;
  ibkrLocalGateway: boolean;
}

export interface HostingEnvironmentInfo {
  hostingMode: HostingMode;
  isCloud: boolean;
  isLocalhost: boolean;
  version: string;
  detectedFrom: string;
  clientIp?: string;
  hostname?: string;
  features: HostingFeatures;
  recommendations: {
    copilotModel: string;
    notes: string;
  };
}

/**
 * Checks client-side hostname to determine if running on cloud vs localhost.
 */
export function isClientCloud(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local');
  return !isLocal;
}

export const environmentService = {
  async getHostingEnvironment(): Promise<HostingEnvironmentInfo> {
    const res = await fetch('/api/environment');
    if (!res.ok) {
      // Fallback if endpoint is unavailable
      const isCloud = isClientCloud();
      return {
        hostingMode: isCloud ? 'cloud' : 'local',
        isCloud,
        isLocalhost: !isCloud,
        version: '2.5.0',
        detectedFrom: 'client_hostname_fallback',
        hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
        features: {
          cloudLLM: true,
          gemini: true,
          groq: true,
          openrouter: true,
          tastytradeCloud: true,
          trading212Cloud: true,
          telegramHub: true,
          marketDataCloud: true,
          vectorChartsPdf: true,
          ollamaLocal: !isCloud,
          pythonLangGraphLocal: !isCloud,
          ibkrLocalGateway: !isCloud,
        },
        recommendations: {
          copilotModel: isCloud ? 'google/gemini-2.0-flash-exp:free' : 'auto',
          notes: isCloud
            ? 'Running in Cloud Hosting mode. High-speed cloud models active. Local Ollama disabled.'
            : 'Running in Localhost mode.',
        },
      };
    }
    return res.json();
  },

  async setHostingMode(mode: HostingMode): Promise<{ success: boolean; message: string; environment: HostingEnvironmentInfo }> {
    const res = await fetch('/api/settings/hosting-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update hosting mode (${res.status})`);
    }
    return res.json();
  },
};

export function useHostingEnvironment() {
  const isFallbackCloud = isClientCloud();
  return useQuery<HostingEnvironmentInfo>({
    queryKey: ['hostingEnvironment'],
    queryFn: () => environmentService.getHostingEnvironment(),
    staleTime: 60000,
    initialData: {
      hostingMode: isFallbackCloud ? 'cloud' : 'local',
      isCloud: isFallbackCloud,
      isLocalhost: !isFallbackCloud,
      version: '2.5.0',
      detectedFrom: 'client_hostname_initial',
      hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
      features: {
        cloudLLM: true,
        gemini: true,
        groq: true,
        openrouter: true,
        tastytradeCloud: true,
        trading212Cloud: true,
        telegramHub: true,
        marketDataCloud: true,
        vectorChartsPdf: true,
        ollamaLocal: !isFallbackCloud,
        pythonLangGraphLocal: !isFallbackCloud,
        ibkrLocalGateway: !isFallbackCloud,
      },
      recommendations: {
        copilotModel: isFallbackCloud ? 'google/gemini-2.0-flash-exp:free' : 'auto',
        notes: isFallbackCloud
          ? 'Running in Cloud Hosting mode. Cloud AI active. Local Ollama disabled.'
          : 'Running in Localhost mode.',
      },
    },
  });
}

export function useSwitchHostingMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: HostingMode) => environmentService.setHostingMode(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostingEnvironment'] });
      queryClient.invalidateQueries({ queryKey: ['llm-allowances'] });
    },
  });
}
