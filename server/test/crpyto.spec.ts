import { expect, test } from "bun:test";
import {
  generateAesKey,
  exportKeyToString,
  importKeyFromString, aesEncrypt,
  aesEncryptToString,
  aesDecrypt,
  aesDecryptFromString,
  arrayBufferToBase64,
  base64ToArrayBuffer
} from "../utils/crypto";

test("generateAesKey should create a valid AES key", async () => {
  const key = await generateAesKey();
  expect(key).toBeDefined();
  expect(key.type).toBe("secret");
  expect(key.algorithm.name).toBe("AES-CBC");
});

test("key export and import should work correctly", async () => {
  const originalKey = await generateAesKey();
  const exportedKey = await exportKeyToString(originalKey);
  
  expect(typeof exportedKey).toBe("string");
  expect(exportedKey.length).toBeGreaterThan(0);
  
  const importedKey = await importKeyFromString(exportedKey);
  expect(importedKey).toBeDefined();
  expect(importedKey.type).toBe("secret");
  expect(importedKey.algorithm.name).toBe("AES-CBC");
});

test("arrayBufferToBase64 and base64ToArrayBuffer should be inverses", () => {
  const originalData = new Uint8Array([1, 2, 3, 4, 5]);
  const base64String = arrayBufferToBase64(originalData);
  
  expect(typeof base64String).toBe("string");
  
  const reconstructedBuffer = base64ToArrayBuffer(base64String);
  const reconstructedArray = new Uint8Array(reconstructedBuffer);
  
  expect(reconstructedArray.length).toBe(originalData.length);
  for (let i = 0; i < originalData.length; i++) {
    expect(reconstructedArray[i]).toBe(originalData[i] as number);
  }
});

test("encryption and decryption should work correctly", async () => {
  const key = await generateAesKey();
  const plaintext = "Hello, world!";
  
  const encrypted = await aesEncrypt(plaintext, key);
  expect(encrypted.iv).toBeDefined();
  expect(encrypted.ciphertext).toBeDefined();
  
  const decrypted = await aesDecrypt(encrypted.ciphertext, key, encrypted.iv);
  expect(decrypted).toBe(plaintext);
});

test("string-based encryption and decryption should work correctly", async () => {
  const key = await generateAesKey();
  const plaintext = "Hello, world!";
  
  const encrypted = await aesEncryptToString(plaintext, key);
  expect(typeof encrypted.iv).toBe("string");
  expect(typeof encrypted.ciphertext).toBe("string");
  
  const decrypted = await aesDecryptFromString(encrypted.ciphertext, encrypted.iv, key);
  expect(decrypted).toBe(plaintext);
});