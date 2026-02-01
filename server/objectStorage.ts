import { Client } from "@replit/object-storage";
import * as fs from "fs/promises";
import * as path from "path";

const LOCAL_STORAGE_DIR = ".local-audio";

// Lazy-initialized client - only created when actually needed
let client: Client | null = null;
let clientInitFailed = false;
let useLocalStorage = !process.env.REPL_ID;

async function ensureLocalDir(): Promise<void> {
  await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
}

async function getClient(): Promise<Client> {
  if (clientInitFailed || useLocalStorage) {
    throw new Error("Object storage not available");
  }

  if (!client) {
    try {
      client = new Client();
      await client.list({ prefix: "__test__", limit: 1 });
    } catch (error) {
      clientInitFailed = true;
      client = null;
      useLocalStorage = true;
      throw new Error("Object storage not available, falling back to local");
    }
  }

  return client;
}

export function isObjectStorageAvailable(): boolean {
  return true; // Always available now (local or Replit)
}

export async function uploadAudio(key: string, buffer: Buffer): Promise<string> {
  if (useLocalStorage) {
    await ensureLocalDir();
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    await fs.writeFile(filePath, buffer);
    return key;
  }

  const storageClient = await getClient();
  const result = await storageClient.uploadFromBytes(key, buffer);
  if (!result.ok) {
    throw new Error(`Failed to upload audio: ${result.error.message}`);
  }
  return key;
}

export async function deleteAudio(key: string): Promise<void> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    await fs.unlink(filePath).catch(() => {}); // Ignore if not found
    return;
  }

  const storageClient = await getClient();
  const result = await storageClient.delete(key, { ignoreNotFound: true });
  if (!result.ok) {
    throw new Error(`Failed to delete audio: ${result.error.message}`);
  }
}

export async function downloadAudio(key: string): Promise<Buffer> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    return fs.readFile(filePath);
  }

  const storageClient = await getClient();
  const result = await storageClient.downloadAsBytes(key);
  if (!result.ok) {
    throw new Error(`Failed to download audio: ${result.error.message}`);
  }
  return result.value[0];
}
