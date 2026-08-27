import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { pipeline } from '@xenova/transformers';
import { OggOpusDecoder } from 'ogg-opus-decoder';
import wavefile from 'wavefile';
import { agentActivityTracker } from './agentActivityService';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

// Global cached pipeline instance
let whisperPipelineInstance: any = null;
let isInitializingPipeline = false;
let pipelineInitPromise: Promise<any> | null = null;

/**
 * Lazy loads and caches the Whisper ASR pipeline
 */
export async function getWhisperPipeline() {
  if (whisperPipelineInstance) {
    return whisperPipelineInstance;
  }

  if (pipelineInitPromise) {
    return pipelineInitPromise;
  }

  pipelineInitPromise = (async () => {
    isInitializingPipeline = true;
    try {
      console.log('[VoiceTranscription] Initializing local offline Whisper ASR (Xenova/whisper-tiny.en)...');
      whisperPipelineInstance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        quantized: true,
      });
      console.log('[VoiceTranscription] Whisper ASR pipeline ready.');
      return whisperPipelineInstance;
    } finally {
      isInitializingPipeline = false;
    }
  })();

  return pipelineInitPromise;
}

/**
 * Resamples and downmixes multi-channel audio data to 16,000Hz mono Float32Array
 */
export function resampleAndDownmix(
  channelData: Float32Array[],
  inputSampleRate: number,
  targetSampleRate = 16000
): Float32Array {
  if (!channelData || channelData.length === 0 || channelData[0].length === 0) {
    return new Float32Array(0);
  }

  // 1. Downmix to mono
  let mono: Float32Array;
  if (channelData.length === 1) {
    mono = channelData[0];
  } else {
    mono = new Float32Array(channelData[0].length);
    for (let i = 0; i < mono.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < channelData.length; ch++) {
        sum += channelData[ch][i];
      }
      mono[i] = sum / channelData.length;
    }
  }

  if (inputSampleRate === targetSampleRate) {
    return mono;
  }

  // 2. Linear interpolation resampling
  const ratio = inputSampleRate / targetSampleRate;
  const targetLength = Math.max(1, Math.round(mono.length / ratio));
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const origIndex = i * ratio;
    const i0 = Math.floor(origIndex);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const weight = origIndex - i0;
    result[i] = mono[i0] * (1 - weight) + mono[i1] * weight;
  }

  return result;
}

/**
 * Decodes audio Buffer (supporting Ogg Opus and WAV) to 16kHz mono Float32Array
 */
export async function decodeAudioToFloat32Mono16k(audioBuffer: Buffer): Promise<Float32Array> {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Empty audio buffer provided for decoding.');
  }

  // Check if buffer is a WAV file (RIFF header)
  const isWav = audioBuffer.subarray(0, 4).toString('ascii') === 'RIFF';

  if (isWav) {
    try {
      const wav = new (wavefile as any).WaveFile(audioBuffer);
      wav.toBitDepth('32f');
      wav.toSampleRate(16000);
      let samples = wav.getSamples();
      if (Array.isArray(samples)) {
        samples = samples[0];
      }
      return samples instanceof Float32Array ? samples : new Float32Array(samples);
    } catch (wavErr: any) {
      console.warn('[VoiceTranscription] WAV decode fallback, attempting OGG decoder:', wavErr.message);
    }
  }

  // Decode Ogg/Opus (Telegram default for voice messages)
  const decoder = new OggOpusDecoder();
  try {
    await decoder.ready;
    const { channelData, sampleRate } = await decoder.decodeFile(audioBuffer);
    if (!channelData || channelData.length === 0) {
      throw new Error('OggOpus decoder yielded no channel data.');
    }
    return resampleAndDownmix(channelData, sampleRate || 48000, 16000);
  } finally {
    try {
      decoder.free();
    } catch {
      // ignore decoder cleanup err
    }
  }
}

/**
 * Downloads a voice message audio file from Telegram Bot API using file_id
 */
export async function downloadTelegramVoiceFile(
  fileId: string,
  botToken = process.env.TELEGRAM_BOT_TOKEN
): Promise<{ fileBuffer: Buffer; filePath: string; localTempPath?: string }> {
  if (!botToken) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN in environment variables.');
  }

  // 1. Call getFile endpoint
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const getFileRes = await fetch(getFileUrl);
  const getFileData = await getFileRes.json();

  if (!getFileRes.ok || !getFileData.ok || !getFileData.result?.file_path) {
    throw new Error(
      `Telegram getFile error: ${getFileData.description || `HTTP ${getFileRes.status}`}`
    );
  }

  const telegramFilePath = getFileData.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;

  // 2. Download audio binary
  const downloadRes = await fetch(downloadUrl);
  if (!downloadRes.ok) {
    throw new Error(`Failed to download audio file from Telegram: HTTP ${downloadRes.status}`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // 3. Save to local temporary directory
  const tempDir = path.resolve(process.cwd(), 'temp_audio');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const ext = path.extname(telegramFilePath) || '.ogg';
  const localTempPath = path.join(tempDir, `voice_${Date.now()}_${fileId.slice(-8)}${ext}`);
  fs.writeFileSync(localTempPath, fileBuffer);

  return {
    fileBuffer,
    filePath: telegramFilePath,
    localTempPath,
  };
}

/**
 * Transcribes an audio buffer locally using offline Whisper AI
 */
export async function transcribeAudioBuffer(audioBuffer: Buffer): Promise<string> {
  const pcm16k = await decodeAudioToFloat32Mono16k(audioBuffer);

  if (pcm16k.length === 0) {
    return '';
  }

  const transcriber = await getWhisperPipeline();
  const output = await transcriber(pcm16k, {
    chunk_length_s: 30,
    stride_length_s: 5,
    language: 'english',
    task: 'transcribe',
  });

  const text = (output?.text || '').trim();
  return text;
}

/**
 * Complete pipeline: Download voice note by fileId from Telegram, transcribe locally, and cleanup temp file
 */
export async function transcribeTelegramVoice(
  fileId: string
): Promise<{ transcribedText: string; fileId: string; durationSec?: number }> {
  const task = agentActivityTracker.startTask({
    agentName: 'Offline Whisper Voice Transcriber',
    agentType: 'RESEARCH_AGENT',
    taskDescription: `Downloading and transcribing Telegram voice note (${fileId.slice(0, 12)}...) locally`,
    metadata: { fileId },
  });

  let localTempPath: string | undefined;

  try {
    const downloaded = await downloadTelegramVoiceFile(fileId);
    localTempPath = downloaded.localTempPath;

    const transcribedText = await transcribeAudioBuffer(downloaded.fileBuffer);

    // Clean up temporary audio file
    if (localTempPath && fs.existsSync(localTempPath)) {
      try {
        fs.unlinkSync(localTempPath);
      } catch {
        // ignore unlink error
      }
    }

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Transcribed: "${transcribedText.slice(0, 50)}${transcribedText.length > 50 ? '...' : ''}"`,
      metadata: { transcribedText, fileId },
    });

    return {
      transcribedText,
      fileId,
    };
  } catch (error: any) {
    if (localTempPath && fs.existsSync(localTempPath)) {
      try {
        fs.unlinkSync(localTempPath);
      } catch {
        // ignore
      }
    }

    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      outcomeSummary: `Failed to transcribe voice note: ${error.message}`,
      error: error.message,
    });

    throw error;
  }
}
