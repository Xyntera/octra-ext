// Transaction builder — mirrors webcli main.cpp sign_tx_fields + submit_tx
// Field names: from, to_, amount (raw int64 as string), nonce, ou, timestamp,
//              op_type, signature, public_key

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils';
import { submitTx, getAccount, getBalance as getRpcBalance } from './rpc.js';

ed.etc.sha512Sync = (...msgs) => sha512(concatBytes(...msgs));

// Raw micro-units: 1 OCTRA = 1_000_000
const MU = 1_000_000n;

function toRaw(amount) {
  // Handle float like "0.1" → 100000n
  const [int, frac = ''] = String(amount).split('.');
  const fracPadded = frac.padEnd(6, '0').slice(0, 6);
  return BigInt(int) * MU + BigInt(fracPadded);
}

// canonical_json: sorted keys, no spaces — matches octra::canonical_json()
function canonicalJson(obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

async function signPayload(payload, privKeyB64) {
  const msg     = utf8ToBytes(canonicalJson(payload));
  const hash    = sha256(msg);
  const privKey = new Uint8Array(Buffer.from(privKeyB64, 'base64').slice(0, 32));
  const sig     = await ed.signAsync(hash, privKey);
  return Buffer.from(sig).toString('base64');
}

async function getNonce(address) {
  try {
    const acc = await getAccount(address);
    // Use pending_nonce if available (accounts for mempool)
    return acc?.pending_nonce ?? acc?.nonce ?? 0;
  } catch { return 0; }
}

// ─── Standard Transfer ───────────────────────────────────────────────────────
export async function sendTransfer(wallet, to, amount, memo = '') {
  const nonce   = (await getNonce(wallet.address)) + 1;
  const raw     = toRaw(amount);
  // ou (fee) — 10000 for small, 30000 for large
  const ou      = raw < 1_000_000_000n ? '10000' : '30000';

  const payload = {
    from:       wallet.address,
    to_:        to,
    amount:     String(raw),
    nonce,
    ou,
    timestamp:  Date.now() / 1000,   // float seconds like C++ now_ts()
    op_type:    'standard',
    ...(memo ? { message: memo } : {}),
  };

  const signature = await signPayload(payload, wallet.privKeyB64);
  const tx = { ...payload, signature, public_key: wallet.pubKeyB64 };
  return submitTx(tx);
}

// ─── Batch Transfer ──────────────────────────────────────────────────────────
export async function sendBatch(wallet, recipients) {
  let nonce = (await getNonce(wallet.address)) + 1;
  const results = [];
  for (const r of recipients) {
    const raw = toRaw(r.amount);
    const ou  = raw < 1_000_000_000n ? '10000' : '30000';
    const payload = {
      from:      wallet.address,
      to_:       r.to,
      amount:    String(raw),
      nonce,
      ou,
      timestamp: Date.now() / 1000,
      op_type:   'standard',
      ...(r.memo ? { message: r.memo } : {}),
    };
    const signature = await signPayload(payload, wallet.privKeyB64);
    const tx = { ...payload, signature, public_key: wallet.pubKeyB64 };
    results.push(await submitTx(tx));
    nonce++;
  }
  return results;
}

// ─── Encrypt Balance (FHE) ────────────────────────────────────────────────────
export async function encryptBalance(wallet, amount) {
  const nonce = (await getNonce(wallet.address)) + 1;
  const raw   = toRaw(amount);
  const payload = {
    from:      wallet.address,
    to_:       wallet.address,
    amount:    String(raw),
    nonce,
    ou:        '10000',
    timestamp: Date.now() / 1000,
    op_type:   'encrypt',
  };
  const signature = await signPayload(payload, wallet.privKeyB64);
  const tx = { ...payload, signature, public_key: wallet.pubKeyB64 };
  return submitTx(tx);
}

// ─── Decrypt Balance (FHE) ────────────────────────────────────────────────────
export async function decryptBalance(wallet, amount) {
  const nonce = (await getNonce(wallet.address)) + 1;
  const raw   = toRaw(amount);
  const payload = {
    from:      wallet.address,
    to_:       wallet.address,
    amount:    String(raw),
    nonce,
    ou:        '10000',
    timestamp: Date.now() / 1000,
    op_type:   'decrypt',
  };
  const signature = await signPayload(payload, wallet.privKeyB64);
  const tx = { ...payload, signature, public_key: wallet.pubKeyB64 };
  return submitTx(tx);
}

// ─── Stealth Send ──────────────────────────────────────────────────────────────
export async function stealthSend(wallet, recipientAddr, amount) {
  const nonce = (await getNonce(wallet.address)) + 1;
  const raw   = toRaw(amount);
  const payload = {
    from:      wallet.address,
    to_:       'stealth',
    amount:    '0',
    nonce,
    ou:        '5000',
    timestamp: Date.now() / 1000,
    op_type:   'stealth',
  };
  const signature = await signPayload(payload, wallet.privKeyB64);
  const tx = { ...payload, signature, public_key: wallet.pubKeyB64 };
  return submitTx(tx);
}
