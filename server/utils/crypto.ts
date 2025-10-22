import { logError } from "./log";
import "../api/precede.ts";
const crypto = globalThis.crypto;

/**
 * Generates an AES encryption key with specified bit length
 */
async function generateAesKey(length = 256): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    {
      name: "AES-CBC",
      length,
    },
    true,
    ["encrypt", "decrypt"],
  );
  return key;
}

/**
 * Exports a CryptoKey to base64 string format for storage
 */
async function exportKeyToString(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exported);
}

/**
 * Imports a CryptoKey from base64 string format
 */
async function importKeyFromString(keyStr: string): Promise<CryptoKey> {
  try {
    const keyBuffer = base64ToArrayBuffer(keyStr);
    return crypto.subtle.importKey("raw", keyBuffer, "AES-CBC", false, [
      "encrypt",
      "decrypt",
    ]);
  } catch (error) {
    logError("Failed to import encryption key from base64 string:", error);
    throw error;
  }
}

/**
 * Loads encryption key from environment variable or generates a new one
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const envKey = global.customEnv.ENCRYPTION_KEY;
  if (envKey) {
    try {
      return await importKeyFromString(envKey);
    } catch (error) {
      logError(
        "Failed to import encryption key from environment variable:",
        error,
      );
    }
  }
  return generateAesKey();
}

/**
 * Encrypts plaintext using AES-CBC
 */
async function aesEncrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<{
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}> {
  const ec = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(16));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv,
    },
    key,
    ec.encode(plaintext),
  );

  return {
    iv,
    ciphertext,
  };
}

/**
 * Encrypts plaintext and returns everything as base64 strings
 */
async function aesEncryptToString(
  plaintext: string,
  key: CryptoKey,
): Promise<{
  iv: string;
  ciphertext: string;
}> {
  const encrypted = await aesEncrypt(plaintext, key);
  return {
    iv: arrayBufferToBase64(encrypted.iv),
    ciphertext: arrayBufferToBase64(encrypted.ciphertext),
  };
}

/**
 * Decrypts ciphertext using AES-CBC
 */
async function aesDecrypt(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<string> {
  const dec = new TextDecoder();
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: new Uint8Array(iv),
    },
    key,
    ciphertext,
  );

  return dec.decode(plaintext);
}

// BUG: 这是一个同步函数，不要用 async
/**
 * Decrypts from string format (base64 encoded values)
 */
async function aesDecryptFromString(
  ciphertextStr: string,
  ivStr: string,
  key: CryptoKey,
): Promise<string> {
  const iv = base64ToArrayBuffer(ivStr);
  const ciphertext = base64ToArrayBuffer(ciphertextStr);
  return aesDecrypt(ciphertext, key, new Uint8Array(iv));
}

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    logError("Failed to convert base64 to ArrayBuffer:", base64);
    throw error;
  }
}

/**
 * Hash a password using built-in crypto API
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export {
  generateAesKey,
  exportKeyToString,
  importKeyFromString,
  getEncryptionKey,
  aesEncrypt,
  aesEncryptToString,
  aesDecrypt,
  aesDecryptFromString,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  hashPassword,
  verifyPassword,
};
