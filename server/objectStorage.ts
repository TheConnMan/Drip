import { objectStorageClient } from "./replit_integrations/object_storage";
import * as fs from "fs/promises";
import * as path from "path";

const LOCAL_STORAGE_DIR = ".local-storage";
const useLocalStorage = !process.env.REPL_ID;

async function ensureLocalDir(): Promise<void> {
  await fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true });
}

function getPublicPath(): { bucketName: string; prefix: string } {
  const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const publicPath = pathsStr.split(",")[0]?.trim();
  
  if (!publicPath) {
    throw new Error(
      "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in Object Storage tool."
    );
  }
  
  const parts = publicPath.startsWith("/") ? publicPath.slice(1).split("/") : publicPath.split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  
  return { bucketName, prefix };
}

export function isObjectStorageAvailable(): boolean {
  return true;
}

export async function uploadAudio(key: string, buffer: Buffer): Promise<string> {
  if (useLocalStorage) {
    await ensureLocalDir();
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    await fs.writeFile(filePath, buffer);
    return key;
  }

  const { bucketName, prefix } = getPublicPath();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectPath = prefix ? `${prefix}/${key}` : key;
  const file = bucket.file(objectPath);
  
  await file.save(buffer, {
    contentType: "audio/mpeg",
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });
  
  console.log(`[object-storage] Uploaded audio to ${bucketName}/${objectPath}`);
  return key;
}

export async function deleteAudio(key: string): Promise<void> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    await fs.unlink(filePath).catch(() => {});
    return;
  }

  const { bucketName, prefix } = getPublicPath();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectPath = prefix ? `${prefix}/${key}` : key;
  const file = bucket.file(objectPath);
  
  try {
    await file.delete({ ignoreNotFound: true });
    console.log(`[object-storage] Deleted audio ${objectPath}`);
  } catch (error) {
    console.error(`Failed to delete audio ${key}:`, error);
  }
}

export async function downloadAudio(key: string): Promise<Buffer> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    return fs.readFile(filePath);
  }

  const { bucketName, prefix } = getPublicPath();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectPath = prefix ? `${prefix}/${key}` : key;
  const file = bucket.file(objectPath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Audio file not found: ${key}`);
  }

  const [contents] = await file.download();
  return contents;
}

// Image storage functions

export async function uploadImage(key: string, buffer: Buffer): Promise<string> {
  if (useLocalStorage) {
    await ensureLocalDir();
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    await fs.writeFile(filePath, buffer);
    return key;
  }

  const { bucketName, prefix } = getPublicPath();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectPath = prefix ? `${prefix}/${key}` : key;
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType: "image/png",
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  console.log(`[object-storage] Uploaded image to ${bucketName}/${objectPath}`);
  return key;
}

export async function getImagePublicUrl(key: string): Promise<string> {
  if (useLocalStorage) {
    // For local development, serve via the /image endpoint
    return `/image/${encodeURIComponent(key)}`;
  }

  const { bucketName, prefix } = getPublicPath();
  const objectPath = prefix ? `${prefix}/${key}` : key;

  // Construct the public URL for Replit Object Storage
  // Format: https://storage.googleapis.com/{bucket}/{path}
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}

export async function downloadImage(key: string): Promise<Buffer> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    return fs.readFile(filePath);
  }

  const { bucketName, prefix } = getPublicPath();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectPath = prefix ? `${prefix}/${key}` : key;
  const file = bucket.file(objectPath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Image file not found: ${key}`);
  }

  const [contents] = await file.download();
  return contents;
}

export async function deleteImage(key: string): Promise<void> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key.replace(/\//g, "_"));
    await fs.unlink(filePath).catch(() => {});
    return;
  }

  const { bucketName, prefix } = getPublicPath();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectPath = prefix ? `${prefix}/${key}` : key;
  const file = bucket.file(objectPath);

  try {
    await file.delete({ ignoreNotFound: true });
    console.log(`[object-storage] Deleted image ${objectPath}`);
  } catch (error) {
    console.error(`Failed to delete image ${key}:`, error);
  }
}
