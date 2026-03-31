// Encrypted wallet storage — AES-256-GCM + PBKDF2
import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const WALLET_DIR  = join(homedir(), '.octra', 'wallets');
const DEFAULT_FILE = join(homedir(), '.octra', 'default');
const PBKDF2_ITER  = 210_000;

function ensureDir() {
  mkdirSync(WALLET_DIR, { recursive: true });
}

function deriveKey(pin, salt) {
  return pbkdf2Sync(pin, salt, PBKDF2_ITER, 32, 'sha256');
}

export function saveWallet(wallet, pin) {
  ensureDir();
  const salt = randomBytes(16);
  const iv   = randomBytes(12);
  const key  = deriveKey(pin, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain  = JSON.stringify(wallet);
  const enc    = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  const payload = JSON.stringify({
    v:    2,
    salt: salt.toString('hex'),
    iv:   iv.toString('hex'),
    tag:  tag.toString('hex'),
    data: enc.toString('hex'),
  });
  const fname = `${wallet.address}.oct`;
  const fpath = join(WALLET_DIR, fname);
  writeFileSync(fpath, payload, 'utf8');
  // Auto-set default if first wallet
  if (!existsSync(DEFAULT_FILE)) {
    writeFileSync(DEFAULT_FILE, wallet.address, 'utf8');
  }
  return fpath;
}

export function loadWallet(address, pin) {
  ensureDir();
  const addr = address || getDefaultAddress();
  if (!addr) throw new Error('No wallet address provided');
  const fpath = join(WALLET_DIR, `${addr}.oct`);
  if (!existsSync(fpath)) throw new Error(`Wallet file not found: ${fpath}`);
  const payload = JSON.parse(readFileSync(fpath, 'utf8'));
  const salt = Buffer.from(payload.salt, 'hex');
  const iv   = Buffer.from(payload.iv,   'hex');
  const tag  = Buffer.from(payload.tag,  'hex');
  const enc  = Buffer.from(payload.data, 'hex');
  const key  = deriveKey(pin, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

export function listWallets() {
  ensureDir();
  const files = readdirSync(WALLET_DIR).filter(f => f.endsWith('.oct'));
  return files.map(f => {
    try {
      const raw = JSON.parse(readFileSync(join(WALLET_DIR, f), 'utf8'));
      // Extract address from filename (no PIN needed for listing)
      const address = f.replace('.oct', '');
      return { address, name: raw.name || '' };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export function getDefaultAddress() {
  if (existsSync(DEFAULT_FILE)) {
    const addr = readFileSync(DEFAULT_FILE, 'utf8').trim();
    if (addr) return addr;
  }
  // Fall back to first wallet
  const wallets = listWallets();
  return wallets[0]?.address || null;
}

export function setDefaultAddress(address) {
  ensureDir();
  writeFileSync(DEFAULT_FILE, address, 'utf8');
}
