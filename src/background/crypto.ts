import nacl from 'tweetnacl';
import { mnemonicToSeedSync, generateMnemonic, validateMnemonic } from 'bip39';
import bs58 from 'bs58';

// ── Key derivation ──────────────────────────────────────────────────────────
export function generateMnemonic12(): string {
  return generateMnemonic(128);
}

export function validateMnemonicWords(m: string): boolean {
  return validateMnemonic(m);
}

export function seedFromMnemonic(mnemonic: string): Uint8Array {
  return mnemonicToSeedSync(mnemonic).slice(0, 32);
}

export function keypairFromSeed(seed: Uint8Array): nacl.SignKeyPair {
  return nacl.sign.keyPair.fromSeed(seed);
}

export function addressFromPublicKey(pk: Uint8Array): string {
  return 'oct' + bs58.encode(pk);
}

export function publicKeyHex(pk: Uint8Array): string {
  return Buffer.from(pk).toString('hex');
}

export function secretKeyHex(sk: Uint8Array): string {
  return Buffer.from(sk).toString('hex');
}

// ── Password encryption ──────────────────────────────────────────────────────
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithPassword(data: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);
  const enc  = new TextEncoder();
  const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));
  const result = new Uint8Array(salt.length + iv.length + ct.byteLength);
  result.set(salt, 0);
  result.set(iv, 16);
  result.set(new Uint8Array(ct), 28);
  return Buffer.from(result).toString('hex');
}

export async function decryptWithPassword(hex: string, password: string): Promise<string> {
  const data = Buffer.from(hex, 'hex');
  const salt = data.slice(0, 16);
  const iv   = data.slice(16, 28);
  const ct   = data.slice(28);
  const key  = await deriveKey(password, salt);
  const pt   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return Buffer.from(hash).toString('hex');
}

// ── Signing ──────────────────────────────────────────────────────────────────
export function signMessage(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, secretKey);
}

export function hexToUint8(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}
