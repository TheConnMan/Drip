import fs from 'fs';
import path from 'path';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
// Default to Chris voice
const DEFAULT_VOICE_ID = 'iP95p4xoKVk53GoZ742B';

interface TTSResult {
  audioBuffer: Buffer;
  durationSeconds: number;
}

interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
}

interface ElevenLabsRequestBody {
  text: string;
  model_id: string;
  voice_settings: ElevenLabsVoiceSettings;
}

export async function generateSpeech(
  text: string,
  voiceId?: string | null
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }

  const effectiveVoiceId = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || DEFAULT_VOICE_ID;

  const requestBody: ElevenLabsRequestBody = {
    text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/text-to-speech/${effectiveVoiceId}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // Estimate duration based on typical speech rate (~150 words per minute)
  const wordCount = text.split(/\s+/).length;
  const estimatedDurationSeconds = Math.round((wordCount / 150) * 60);

  return {
    audioBuffer,
    durationSeconds: estimatedDurationSeconds,
  };
}

// Audio file storage
const AUDIO_STORAGE_PATH = process.env.AUDIO_STORAGE_PATH || './storage/audio';

export function ensureAudioStorageDirectory(): void {
  if (!fs.existsSync(AUDIO_STORAGE_PATH)) {
    fs.mkdirSync(AUDIO_STORAGE_PATH, { recursive: true });
  }
}

function getCourseStoragePath(courseId: number): string {
  const coursePath = path.join(AUDIO_STORAGE_PATH, String(courseId));
  if (!fs.existsSync(coursePath)) {
    fs.mkdirSync(coursePath, { recursive: true });
  }
  return coursePath;
}

export async function saveAudioFile(
  courseId: number,
  lessonNumber: number,
  audioBuffer: Buffer
): Promise<{ filePath: string; fileSize: number }> {
  ensureAudioStorageDirectory();
  const coursePath = getCourseStoragePath(courseId);
  const fileName = `${lessonNumber}.mp3`;
  const filePath = path.join(coursePath, fileName);

  fs.writeFileSync(filePath, audioBuffer);

  return {
    filePath,
    fileSize: audioBuffer.length,
  };
}

export function getAudioFilePath(courseId: number, lessonNumber: number): string | null {
  const filePath = path.join(AUDIO_STORAGE_PATH, String(courseId), `${lessonNumber}.mp3`);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

export function getPublicAudioUrl(courseId: number, lessonNumber: number): string {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  return `${baseUrl}/audio/${courseId}/${lessonNumber}.mp3`;
}

export function deleteAudioFile(courseId: number, lessonNumber: number): boolean {
  const filePath = getAudioFilePath(courseId, lessonNumber);
  if (!filePath) return false;

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
