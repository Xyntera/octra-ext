// Octra crypto — exact mirror of octra-labs/webcli crypto_utils.hpp + wallet.hpp

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToHex, concatBytes } from '@noble/hashes/utils';
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

// ── Mnemonic → master seed (PBKDF2-SHA512, 2048 rounds, salt="mnemonic") ──────
// Mirrors: mnemonic_to_seed() in crypto_utils.hpp
export function mnemonicToMasterSeed(mnemonic) {
  // webcli uses PKCS5_PBKDF2_HMAC(mnemonic, "mnemonic", 2048, sha512, 64)
  // @scure/bip39 mnemonicToSeedSync does exactly that (BIP39 standard)
  return mnemonicToSeedSync(mnemonic); // returns 64-byte Uint8Array
}

// ── HD seed derivation — exact replica of derive_hd_seed() in crypto_utils.hpp
// hd_version=2, index=0: HMAC-SHA512(key="Octra seed", data=masterSeed64)[0:32]
// hd_version=1, index=0: masterSeed64[0:32] directly
// index>0: HMAC-SHA512(key="Octra seed", data=masterSeed64+index_le32)[0:32]
export function deriveHdSeed(masterSeed64, index = 0, hdVersion = 2) {
  if (hdVersion === 1 && index === 0) {
    return new Uint8Array(masterSeed64.slice(0, 32));
  }
  const key  = Buffer.from('Octra seed', 'utf8');   // exactly "Octra seed"
  let   data = Buffer.from(masterSeed64);
  if (index > 0) {
    const idxBuf = Buffer.alloc(4);
    idxBuf.writeUInt32LE(index, 0);
    data = Buffer.concat([data, idxBuf]);  // masterSeed64 bytes + 4-byte LE index
  }
  const mac = createHmac('sha512', key).update(data).digest();
  return new Uint8Array(mac.slice(0, 32));
}

// ── keypairFromSeed: derive Ed25519 keypair from 32-byte seed ─────────────────
// Noble ed25519 uses the seed directly as the private key scalar input
export function keypairFromSeed(seed32) {
  const privKey = new Uint8Array(seed32).slice(0, 32);
  const pubKey  = ed.getPublicKeySync(privKey);
  return { privKey, pubKey };
}

// ── Address: sha256(pubkey) → base58 → prepend "oct" ──────────────────────────
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let num = BigInt('0x' + bytesToHex(bytes));
  let result = '';
  const base = BigInt(58);
  while (num > 0n) {
    result = B58[Number(num % base)] + result;
    num /= base;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    result = '1' + result;
  }
  return result;
}

export function deriveAddress(pubKey) {
  const hash = sha256(pubKey);
  let b58    = base58Encode(hash);
  while (b58.length < 44) b58 = '1' + b58;
  return 'oct' + b58;
}

// ── Wallet builders ───────────────────────────────────────────────────────────
export function createWalletFromMnemonic(mnemonic, index = 0, hdVersion = 2) {
  const masterSeed = mnemonicToMasterSeed(mnemonic);
  const hdSeed     = deriveHdSeed(masterSeed, index, hdVersion);
  const { privKey, pubKey } = keypairFromSeed(hdSeed);
  return {
    mnemonic,
    masterSeedB64: Buffer.from(masterSeed).toString('base64'),
    privKeyB64:    Buffer.from(privKey).toString('base64'),
    pubKeyB64:     Buffer.from(pubKey).toString('base64'),
    address:       deriveAddress(pubKey),
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

export function createWalletFromPrivKey(privKeyB64) {
  const clean  = privKeyB64.replace(/[\n\r\s]/g, '');
  const raw    = new Uint8Array(Buffer.from(clean, 'base64'));
  let privKey, pubKey;
  if (raw.length >= 64) {
    privKey = raw.slice(0, 32);
    pubKey  = raw.slice(32, 64);
    // Verify pubKey matches seed derivation
    const derived = ed.getPublicKeySync(privKey);
    if (bytesToHex(derived) !== bytesToHex(pubKey)) {
      // Use derived as authoritative
      pubKey = derived;
    }
  } else if (raw.length >= 32) {
    privKey = raw.slice(0, 32);
    pubKey  = ed.getPublicKeySync(privKey);
  } else {
    throw new Error(`Invalid private key length: ${raw.length} bytes`);
  }
  return {
    mnemonic:      '',
    masterSeedB64: '',
    privKeyB64:    Buffer.from(privKey).toString('base64'),
    pubKeyB64:     Buffer.from(pubKey).toString('base64'),
    address:       deriveAddress(pubKey),
    hdIndex:       0,
    hdVersion:     0,
  };
}

// ── Signing: sign raw message bytes with Ed25519 (no pre-hash) ────────────────
// Mirrors: ed25519_sign_detached() in tx_builder.hpp
// Uses @noble/ed25519 which matches TweetNaCl for standard Ed25519
export async function signBytes(msgBytes, privKeyB64) {
  const privKey = new Uint8Array(Buffer.from(privKeyB64, 'base64').slice(0, 32));
  const sig     = await ed.signAsync(msgBytes, privKey);
  return Buffer.from(sig).toString('base64');
}

// Legacy compat
export async function signTx(txPayload, privKeyB64) {
  const { utf8ToBytes } = await import('@noble/hashes/utils');
  return signBytes(utf8ToBytes(JSON.stringify(txPayload)), privKeyB64);
}
