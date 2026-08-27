import { describe, it, expect, vi, beforeEach } from 'vitest';
import wavefile from 'wavefile';
import {
  resampleAndDownmix,
  decodeAudioToFloat32Mono16k,
  transcribeAudioBuffer,
  downloadTelegramVoiceFile,
} from '../../server/services/voiceTranscriptionService';
import { consumeTelegramBuffer } from '../../server/services/telegramBufferConsumerService';

describe('Offline Voice Transcription & Telegram Pipeline', () => {
  it('should downmix and resample audio channels to 16,000Hz mono Float32Array', () => {
    // Create 48kHz stereo test channels
    const length48k = 48000; // 1 second
    const left = new Float32Array(length48k);
    const right = new Float32Array(length48k);
    for (let i = 0; i < length48k; i++) {
      left[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      right[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const resampled = resampleAndDownmix([left, right], 48000, 16000);

    expect(resampled).toBeDefined();
    expect(resampled.length).toBe(16000); // 1 sec at 16kHz
    expect(resampled instanceof Float32Array).toBe(true);
  });

  it('should decode a standard WAV buffer to 16kHz Float32Array', async () => {
    // Generate a valid 16kHz mono WAV file in memory
    const wav = new (wavefile as any).WaveFile();
    const samples = new Float32Array(16000);
    for (let i = 0; i < 16000; i++) {
      samples[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / 16000);
    }
    wav.fromScratch(1, 16000, '32f', samples);
    const wavBuffer = Buffer.from(wav.toBuffer());

    const decoded = await decodeAudioToFloat32Mono16k(wavBuffer);

    expect(decoded).toBeDefined();
    expect(decoded.length).toBe(16000);
    expect(decoded instanceof Float32Array).toBe(true);
  });

  it('should download audio file using Telegram getFile and download endpoint', async () => {
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/getFile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              file_id: 'voice_12345',
              file_unique_id: 'unique_12345',
              file_path: 'voice/file_0.oga',
              file_size: 1024,
            },
          }),
        });
      }

      if (url.includes('/file/bot')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00]).buffer,
        });
      }

      return Promise.reject(new Error('Unknown URL: ' + url));
    }) as any;

    try {
      const result = await downloadTelegramVoiceFile('voice_12345', 'mock-bot-token');

      expect(result).toBeDefined();
      expect(result.filePath).toBe('voice/file_0.oga');
      expect(Buffer.isBuffer(result.fileBuffer)).toBe(true);
      expect(result.fileBuffer.length).toBe(5);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should process voice note items in consumeTelegramBuffer and create tagged ThoughtLog entries', async () => {
    const originalFetch = global.fetch;

    const mockSavedLogs: any[] = [];
    const mockPrisma = {
      thoughtLog: {
        create: vi.fn().mockImplementation(({ data }) => {
          const record = { id: `log-${Date.now()}`, ...data };
          mockSavedLogs.push(record);
          return Promise.resolve(record);
        }),
      },
    } as any;

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/consume')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            count: 1,
            messages: [
              {
                id: 'msg_1787820000000_991',
                messageId: 991,
                type: 'voice',
                text: '🎙️ [Voice Note]',
                fileId: 'mock_voice_file_id_88',
                duration: 4,
                timestamp: '2026-08-27T10:00:00.000Z',
                sender: { id: 12345, username: 'trader_dan', firstName: 'Dan' },
              },
            ],
          }),
        });
      }

      if (url.includes('/getFile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              file_id: 'mock_voice_file_id_88',
              file_path: 'voice/sample.wav',
            },
          }),
        });
      }

      if (url.includes('/file/bot')) {
        // Generate valid synthetic 0.5s wav
        const wav = new (wavefile as any).WaveFile();
        const samples = new Float32Array(8000);
        wav.fromScratch(1, 16000, '32f', samples);
        const wavBuf = Buffer.from(wav.toBuffer());
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => wavBuf.buffer,
        });
      }

      return Promise.reject(new Error('Unknown fetch: ' + url));
    }) as any;

    try {
      process.env.TELEGRAM_BUFFER_URL = 'https://telegram-thought-buffer.financy-appy-bot.workers.dev';
      process.env.TELEGRAM_BOT_TOKEN = 'mock-token';

      const syncResult = await consumeTelegramBuffer(mockPrisma);

      expect(syncResult.success).toBe(true);
      expect(syncResult.consumedCount).toBe(1);
      expect(mockSavedLogs.length).toBe(1);

      const saved = mockSavedLogs[0];
      expect(saved.title).toContain('🎙️');
      expect(saved.tags).toContain('Voice');
      expect(saved.tags).toContain('Telegram');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
