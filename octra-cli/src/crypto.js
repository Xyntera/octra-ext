// Octra crypto — Ed25519 (tweetnacl-compatible) + BIP39 + address derivation
// Mirrors: octra-labs/webcli crypto_utils.hpp + wallet.hpp

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToHex, hexToBytes, concatBytes, utf8ToBytes } from '@noble/hashes/utils';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { createHmac } from 'node:crypto';

ed.etc.sha512Sync = (...msgs) => sha512(concatBytes(...msgs));

// ── BIP39 ────────────────────────────────────────────────────────────────────

export function generateMnemonic12() {
  return generateMnemonic(wordlist, 128); // 12 words
}

export function validateMnemonicPhrase(phrase) {
  return validateMnemonic(phrase, wordlist);
}

// ── HD Key Derivation ────────────────────────────────────────────────────────
// Matches derive_hd_seed() in crypto_utils.hpp (HMAC-SHA512 based, hd_version 2)

export function mnemonicToMasterSeed(mnemonic) {
  // BIP39 seed = 64 bytes
  return mnemonicToSeedSync(mnemonic);
}

export function deriveHdSeed(masterSeed64, index = 0, hdVersion = 2) {
  // hd_version 2: HMAC-SHA512(master_seed, "octra" || LE32(index))
  const label = hdVersion === 2 ? 'octra' : 'octra-hd';
  const idxBuf = Buffer.alloc(4);
  idxBuf.writeUInt32LE(index, 0);
  const key = Buffer.from(masterSeed64);
  const data = Buffer.concat([utf8ToBytes(label), idxBuf]);
  const hmac = createHmac('sha512', key).update(data).digest();
  return new Uint8Array(hmac.slice(0, 32)); // first 32 bytes = seed
}

// ── Key Pair ──────────────────────────────────────────────────────────────────

export function keypairFromSeed(seed32) {
  // Ed25519 keypair: sk = seed(32) || pk(32)
  const privKey = seed32.slice(0, 32);
  const pubKey  = ed.getPublicKey(privKey);
  return { privKey, pubKey };
}

// ── Address Derivation ────────────────────────────────────────────────────────
// derive_address(): SHA256(pubkey) → base58 → left-pad to 44 → prepend "oct"

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let num = BigInt('0x' + bytesToHex(bytes));
  let result = '';
  const base = BigInt(58);
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % base)] + result;
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

// ── Full Wallet Creation ──────────────────────────────────────────────────────

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
  // try both hd_version 1 and 2
  return createWalletFromMnemonic(mnemonic, index, hdVersion);
}

// ── Signing ───────────────────────────────────────────────────────────────────

export function signMessage(messageBytes, privKeyB64) {
  const privKey = new Uint8Array(Buffer.from(privKeyB64, 'base64'));
  return ed.sign(messageBytes, privKey);
}

export async function signTx(txPayload, privKeyB64) {
  // Octra tx signing: sign SHA256(JSON stringify of sorted tx fields)
  const msg = utf8ToBytes(JSON.stringify(txPayload));
  const hash = sha256(msg);
  const privKey = new Uint8Array(Buffer.from(privKeyB64, 'base64'));
  const sig = await ed.signAsync(hash, privKey);
  return Buffer.from(sig).toString('base64');
}
