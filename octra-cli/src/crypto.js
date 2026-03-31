// Octra crypto — Ed25519 + BIP39 + HD + address derivation
// Mirrors: octra-labs/webcli crypto_utils.hpp + wallet.hpp

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { createHmac } from 'node:crypto';

ed.etc.sha512Sync = (...msgs) => sha512(concatBytes(...msgs));

// ── BIP39 ────────────────────────────────────────────────────────────────────

export function generateMnemonic12() {
  return generateMnemonic(wordlist, 128);
}

export function validateMnemonicPhrase(phrase) {
  return validateMnemonic(phrase, wordlist);
}

// ── HD Derivation ───────────────────────────────────────────────────────────────

export function mnemonicToMasterSeed(mnemonic) {
  return mnemonicToSeedSync(mnemonic);
}

export function deriveHdSeed(masterSeed64, index = 0, hdVersion = 2) {
  const label = hdVersion === 2 ? 'octra' : 'octra-hd';
  const idxBuf = Buffer.alloc(4);
  idxBuf.writeUInt32LE(index, 0);
  const key  = Buffer.from(masterSeed64);
  const data = Buffer.concat([Buffer.from(utf8ToBytes(label)), idxBuf]);
  const hmac = createHmac('sha512', key).update(data).digest();
  return new Uint8Array(hmac.slice(0, 32));
}

// ── Key Pair ──────────────────────────────────────────────────────────────────

export function keypairFromSeed(seed32) {
  const privKey = seed32.slice(0, 32);
  const pubKey  = ed.getPublicKey(privKey);
  return { privKey, pubKey };
}

// ── Address ──────────────────────────────────────────────────────────────────

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let num = BigInt('0x' + bytesToHex(bytes));
  let result = '';
  const base = BigInt(58);
  while (num > 0n) {
    result = B58[Number(num % base)] + result;
    num = num / base;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    result = '1' + result;
  }
  return result;
}

export function deriveAddress(pubKey) {
  const hash = sha256(pubKey);
  let b58 = base58Encode(hash);
  while (b58.length < 44) b58 = '1' + b58;
  return 'oct' + b58;
}

// ── Wallet creation helpers ────────────────────────────────────────────────────

export function createWalletFromMnemonic(mnemonic, index = 0, hdVersion = 2) {
  const masterSeed = mnemonicToMasterSeed(mnemonic);
  const hdSeed     = deriveHdSeed(masterSeed, index, hdVersion);
  const { privKey, pubKey } = keypairFromSeed(hdSeed);
  const address   = deriveAddress(pubKey);
  return {
    mnemonic,
    masterSeedHex: bytesToHex(masterSeed),
    privKeyB64:    Buffer.from(privKey).toString('base64'),
    pubKeyB64:     Buffer.from(pubKey).toString('base64'),
    address,
    hdIndex:       index,
    hdVersion,
  };
}

export function createNewWallet() {
  const mnemonic = generateMnemonic12();
  return createWalletFromMnemonic(mnemonic, 0, 2);
}

export function importFromMnemonic(mnemonic, index = 0, hdVersion = 1) {
  if (!validateMnemonicPhrase(mnemonic)) throw new Error('Invalid mnemonic phrase');
  return createWalletFromMnemonic(mnemonic, index, hdVersion);
}

// ── Import from raw private key (base64) ──────────────────────────────────────
export function createWalletFromPrivKey(privKeyB64) {
  // Clean input
  const clean = privKeyB64.replace(/[\n\r\s]/g, '');
  const raw   = new Uint8Array(Buffer.from(clean, 'base64'));

  let privKey, pubKey;
  if (raw.length >= 64) {
    // Full 64-byte keypair (seed+pubkey)
    privKey = raw.slice(0, 32);
    pubKey  = raw.slice(32, 64);
  } else if (raw.length >= 32) {
    // 32-byte seed
    privKey = raw.slice(0, 32);
    pubKey  = ed.getPublicKey(privKey);
  } else {
    throw new Error(`Invalid private key length: ${raw.length} bytes (expected 32 or 64)`);
  }

  const address = deriveAddress(pubKey);
  return {
    mnemonic:      '',
    masterSeedHex: '',
    privKeyB64:    Buffer.from(privKey).toString('base64'),
    pubKeyB64:     Buffer.from(pubKey).toString('base64'),
    address,
    hdIndex:       0,
    hdVersion:     0,
  };
}

// ── Signing ───────────────────────────────────────────────────────────────────

export async function signTx(txPayload, privKeyB64) {
  const msg     = utf8ToBytes(JSON.stringify(txPayload));
  const hash    = sha256(msg);
  const privKey = new Uint8Array(Buffer.from(privKeyB64, 'base64'));
  const sig     = await ed.signAsync(hash, privKey);
  return Buffer.from(sig).toString('base64');
}
