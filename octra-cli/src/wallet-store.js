// Wallet storage — AES-256-GCM encrypted, mirrors webcli wallet.hpp
// File: ~/.octra/wallets/wallet_<addr8>.json

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const WALLET_DIR = join(homedir(), '.octra', 'wallets');
const MANIFEST   = join(homedir(), '.octra', 'accounts.json');
const RPC_DEFAULT = 'http://46.101.86.250:8080';

function ensureDir() {
  mkdirSync(WALLET_DIR, { recursive: true });
}

function walletPath(address) {
  const prefix = address.length > 11 ? address.slice(3, 11) : 'unknown';
  return join(WALLET_DIR, `wallet_${prefix}.json`);
}

// AES-256-GCM encrypt
function encrypt(plaintext, pin) {
  const salt = randomBytes(32);
  const key  = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  const iv   = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 2,
    salt: salt.toString('hex'),
    iv:   iv.toString('hex'),
    tag:  tag.toString('hex'),
    ct:   ct.toString('hex'),
  });
}

// AES-256-GCM decrypt
function decrypt(blob, pin) {
  const { salt, iv, tag, ct } = JSON.parse(blob);
  const key = scryptSync(pin, Buffer.from(salt, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// ── Manifest ──────────────────────────────────────────────────────────────────

export function loadManifest() {
  if (!existsSync(MANIFEST)) return [];
  try { return JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { return []; }
}

export function saveManifest(entries) {
  ensureDir();
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 2));
}

export function manifestUpsert(entry) {
  const entries = loadManifest();
  const idx = entries.findIndex(e => e.address === entry.address);
  if (idx >= 0) Object.assign(entries[idx], entry);
  else entries.push(entry);
  saveManifest(entries);
}

// ── Save / Load ───────────────────────────────────────────────────────────────

export function saveWallet(walletInfo, pin) {
  ensureDir();
  const path = walletPath(walletInfo.address);
  const payload = JSON.stringify({
    privKeyB64:     walletInfo.privKeyB64,
    pubKeyB64:      walletInfo.pubKeyB64,
    address:        walletInfo.address,
    masterSeedHex:  walletInfo.masterSeedHex || '',
    mnemonic:       walletInfo.mnemonic      || '',
    hdIndex:        walletInfo.hdIndex       || 0,
    hdVersion:      walletInfo.hdVersion     || 2,
    rpcUrl:         walletInfo.rpcUrl        || RPC_DEFAULT,
  });
  const encrypted = encrypt(payload, pin);
  writeFileSync(path, encrypted, 'utf8');
  try { chmodSync(path, 0o600); } catch {}
  manifestUpsert({
    name:    walletInfo.name    || '',
    address: walletInfo.address,
    file:    path,
    hdIndex: walletInfo.hdIndex || 0,
  });
  return path;
}

export function loadWallet(address, pin) {
  const entries = loadManifest();
  let file;
  if (address) {
    const entry = entries.find(e => e.address === address || e.address.startsWith(address));
    if (!entry) throw new Error(`Wallet not found: ${address}`);
    file = entry.file;
  } else {
    if (entries.length === 0) throw new Error('No wallets found. Run: octra wallet create');
    file = entries[0].file;
  }
  if (!existsSync(file)) throw new Error(`Wallet file missing: ${file}`);
  let plain;
  try { plain = decrypt(readFileSync(file, 'utf8'), pin); }
  catch { throw new Error('Wrong PIN or corrupted wallet file'); }
  return JSON.parse(plain);
}

export function listWallets() {
  return loadManifest();
}

export function getDefaultAddress() {
  const entries = loadManifest();
  if (entries.length === 0) return null;
  return entries[0].address;
}
