// Transaction builder — exact match of octra-labs/webcli lib/tx_builder.hpp
//
// canonical_json key order: from, to_, amount, nonce, ou, timestamp, op_type
//   (then optional: encrypted_data, message)
// signing: Ed25519 sign of raw UTF-8 canonical_json bytes (NO sha256 pre-hash)
// timestamp: float seconds  e.g. 1743400000.123
// amount: raw int64 string  e.g. "5000000" for 5 OCTRA

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { concatBytes } from '@noble/hashes/utils';
import { submitTx, getAccount, stagingView } from './rpc.js';

ed.etc.sha512Sync = (...msgs) => sha512(concatBytes(...msgs));

const MU = 1_000_000n;

export function toRaw(amount) {
  const s = String(amount);
  const [int, frac = ''] = s.split('.');
  const fracPadded = frac.padEnd(6, '0').slice(0, 6);
  return BigInt(int) * MU + BigInt(fracPadded);
}

export function fromRaw(raw) {
  return (Number(BigInt(raw)) / 1_000_000).toFixed(6);
}

// Exact replica of canonical_json() from tx_builder.hpp
// Key order is FIXED: from, to_, amount, nonce, ou, timestamp, op_type
// (then encrypted_data, message if present)
function canonicalJson(tx) {
  // timestamp serialized as JSON number (float)
  let s = `{"from":"${tx.from}"`
         + `,"to_":"${tx.to_}"`
         + `,"amount":"${tx.amount}"`
         + `,"nonce":${tx.nonce}`
         + `,"ou":"${tx.ou}"`
         + `,"timestamp":${JSON.stringify(tx.timestamp)}`
         + `,"op_type":"${tx.op_type || 'standard'}"`;
  if (tx.encrypted_data) s += `,"encrypted_data":"${tx.encrypted_data}"`;
  if (tx.message)        s += `,"message":"${tx.message}"`;
  s += '}';
  return s;
}

// Sign raw canonical_json bytes with Ed25519 (NO sha256 pre-hash)
// Uses first 32 bytes of privKeyB64 as seed
async function signCanonical(tx, privKeyB64) {
  const msg     = Buffer.from(canonicalJson(tx), 'utf8');
  const privKey = new Uint8Array(Buffer.from(privKeyB64, 'base64').slice(0, 32));
  const sig     = await ed.signAsync(msg, privKey);
  return Buffer.from(sig).toString('base64');
}

// Get nonce including staging/mempool pending txs
export async function getNonce(wallet) {
  try {
    const acc   = await getAccount(wallet.address);
    let nonce   = acc?.pending_nonce ?? acc?.nonce ?? 0;
    try {
      const sv  = await stagingView();
      const txs = Array.isArray(sv) ? sv : (sv?.transactions ?? sv?.txs ?? []);
      for (const t of txs) {
        if ((t.from === wallet.address) && t.nonce > nonce) nonce = t.nonce;
      }
    } catch { /* staging optional */ }
    return nonce;
  } catch { return 0; }
}

async function buildSignSubmit(wallet, fields) {
  const nonce = (await getNonce(wallet)) + 1;
  const tx = {
    from:      wallet.address,
    nonce,
    timestamp: Date.now() / 1000,   // float seconds
    ...fields,
  };
  const signature  = await signCanonical(tx, wallet.privKeyB64);
  const submitBody = { ...tx, signature, public_key: wallet.pubKeyB64 };
  return submitTx(submitBody);
}

// ─── Standard Transfer ───────────────────────────────────────────────────────
export async function sendTransfer(wallet, to, amount, memo = '') {
  const raw = toRaw(amount);
  const ou  = raw < 1_000_000_000n ? '10000' : '30000';
  return buildSignSubmit(wallet, {
    to_:     to,
    amount:  String(raw),
    ou,
    op_type: 'standard',
    ...(memo ? { message: memo } : {}),
  });
}

// ─── Batch Transfer ──────────────────────────────────────────────────────────
export async function sendBatch(wallet, recipients) {
  let nonce = (await getNonce(wallet)) + 1;
  const results = [];
  for (const r of recipients) {
    const raw = toRaw(r.amount);
    const ou  = raw < 1_000_000_000n ? '10000' : '30000';
    const tx  = {
      from:      wallet.address,
      to_:       r.to,
      amount:    String(raw),
      nonce,
      ou,
      timestamp: Date.now() / 1000,
      op_type:   'standard',
      ...(r.memo ? { message: r.memo } : {}),
    };
    const signature  = await signCanonical(tx, wallet.privKeyB64);
    const submitBody = { ...tx, signature, public_key: wallet.pubKeyB64 };
    results.push(await submitTx(submitBody));
    nonce++;
  }
  return results;
}

// ─── Encrypt Balance (public → encrypted) ───────────────────────────────────────
export async function encryptBalance(wallet, amount) {
  const raw = toRaw(amount);
  return buildSignSubmit(wallet, {
    to_:     wallet.address,
    amount:  String(raw),
    ou:      '10000',
    op_type: 'encrypt',
  });
}

// ─── Decrypt Balance (encrypted → public) ───────────────────────────────────────
export async function decryptBalance(wallet, amount) {
  const raw = toRaw(amount);
  return buildSignSubmit(wallet, {
    to_:     wallet.address,
    amount:  String(raw),
    ou:      '10000',
    op_type: 'decrypt',
  });
}

// ─── Stealth Send ──────────────────────────────────────────────────────────────
export async function stealthSend(wallet, recipientAddr, amount) {
  return buildSignSubmit(wallet, {
    to_:     'stealth',
    amount:  '0',
    ou:      '5000',
    op_type: 'stealth',
  });
}
