import { log } from "./index";

const DEFAULT_VOICE_ID = "iP95p4xoKVk53GoZ742B"; // Chris voice
const MODEL_ID = "eleven_turbo_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const BYTES_PER_SECOND = 16000; // mp3 at 128kbps = 16000 bytes per second

interface GenerateSpeechResult {
  audioBuffer: Buffer;
  durationSeconds: number;
}

export async function generateSpeech(text: string): Promise<GenerateSpeechResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  log(`Generating speech for ${text.length} characters`, "elevenlabs");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      log(`ElevenLabs API error: ${response.status} - ${errorText}`, "elevenlabs");
      throw new Error(`ElevenLabs API returned ${response.status}: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const durationSeconds = audioBuffer.length / BYTES_PER_SECOND;

    log(`Speech generated: ${audioBuffer.length} bytes, ~${durationSeconds.toFixed(1)}s`, "elevenlabs");

    return { audioBuffer, durationSeconds };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      log("Speech generation timed out after 1 minute", "elevenlabs");
      throw new Error("Speech generation request timed out after 1 minute");
    }

    log(`Speech generation failed: ${error instanceof Error ? error.message : String(error)}`, "elevenlabs");
    throw error;
  }
}
