import type { EncryptedSecret } from "../shared/types";
import type { BrowseMemoryDatabase } from "../storage/database";

const KEY_ID = "api-key";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export class SecretStore {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async encrypt(value: string): Promise<EncryptedSecret> {
    const key = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(value),
    );
    return {
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
    };
  }

  async decrypt(secret: EncryptedSecret): Promise<string> {
    const key = await this.getOrCreateKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(secret.iv) },
      key,
      fromBase64(secret.ciphertext),
    );
    return decoder.decode(plaintext);
  }

  async hasKey(): Promise<boolean> {
    return (await this.database.cryptoKeys.get(KEY_ID)) !== undefined;
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    const existing = await this.database.cryptoKeys.get(KEY_ID);
    if (existing) {
      return existing.key;
    }
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    await this.database.cryptoKeys.put({ id: KEY_ID, key });
    return key;
  }
}
