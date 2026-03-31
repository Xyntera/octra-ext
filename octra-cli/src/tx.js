// Transaction builder — mirrors webcli main.cpp sign_tx_fields + submit_tx
// All amounts are raw int64 micro-units: 1 OCTRA = 1_000_000

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils';
import { submitTx, getAccount, getEncryptedBalance, stagingView } from './rpc.js';

ed.etc.sha512Sync = (...msgs) => sha512(concatBytes(...msgs));

const MU = 1_000_000n;

export function toRaw(amount) {
  const [int, frac = ''] = String(amount).split('.');
  const fracPadded = frac.padEnd(6, '0').slice(0, 6);
  return BigInt(int) * MU + BigInt(fracPadded);
}

export function fromRaw(raw) {
  const n = BigInt(raw);
  return (Number(n) / 1_000_000).toFixed(6);
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

// Get pending nonce (checks staging/mempool too, like get_nonce_balance in C++)
export async function getNonce(wallet) {
  try {
    const acc = await getAccount(wallet.address);
    let nonce = acc?.pending_nonce ?? acc?.nonce ?? 0;
    // Also check staging for our own pending txs
    try {
      const staging = await stagingView();
      const txs = Array.isArray(staging)
        ? staging
        : (staging?.transactions ?? staging?.txs ?? []);
      for (const tx of txs) {
        if (tx.from === wallet.address && tx.nonce > nonce) {
          nonce = tx.nonce;
        }
      }
    } catch { /* staging optional */ }
    return nonce;
  } catch { return 0; }
}

function buildTx(wallet, fields, nonce) {
  return {
    from:      wallet.address,
    nonce,
    timestamp: Date.now() / 1000,
    ...fields,
  };
}

async function signAndSubmit(wallet, payload) {
  const signature = await signPayload(payload, wallet.privKeyB64);
  const tx = { ...payload, signature, public_key: wallet.pubKeyB64 };
  return submitTx(tx);
}

// ─── Standard Transfer ───────────────────────────────────────────────────────
export async function sendTransfer(wallet, to, amount, memo = '') {
  const nonce = (await getNonce(wallet)) + 1;
  const raw   = toRaw(amount);
  const ou    = raw < 1_000_000_000n ? '10000' : '30000';
  const payload = buildTx(wallet, {
    to_:     to,
    amount:  String(raw),
    ou,
    op_type: 'standard',
    ...(memo ? { message: memo } : {}),
  }, nonce);
  return signAndSubmit(wallet, payload);
}

// ─── Batch Transfer ──────────────────────────────────────────────────────────
export async function sendBatch(wallet, recipients) {
  let nonce = (await getNonce(wallet)) + 1;
  const results = [];
  for (const r of recipients) {
    const raw = toRaw(r.amount);
    const ou  = raw < 1_000_000_000n ? '10000' : '30000';
    const payload = buildTx(wallet, {
      to_:     r.to,
      amount:  String(raw),
      ou,
      op_type: 'standard',
      ...(r.memo ? { message: r.memo } : {}),
    }, nonce);
    results.push(await signAndSubmit(wallet, payload));
    nonce++;
  }
  return results;
}

// ─── Encrypt Balance (move public → encrypted) ───────────────────────────────────
export async function encryptBalance(wallet, amount) {
  const nonce = (await getNonce(wallet)) + 1;
  const raw   = toRaw(amount);
  const payload = buildTx(wallet, {
    to_:     wallet.address,
    amount:  String(raw),
    ou:      '10000',
    op_type: 'encrypt',
  }, nonce);
  return signAndSubmit(wallet, payload);
}

// ─── Decrypt Balance (move encrypted → public) ───────────────────────────────────
export async function decryptBalance(wallet, amount) {
  const nonce = (await getNonce(wallet)) + 1;
  const raw   = toRaw(amount);
  const payload = buildTx(wallet, {
    to_:     wallet.address,
    amount:  String(raw),
    ou:      '10000',
    op_type: 'decrypt',
  }, nonce);
  return signAndSubmit(wallet, payload);
}

// ─── Stealth Send ──────────────────────────────────────────────────────────────
export async function stealthSend(wallet, recipientAddr, amount) {
  const nonce = (await getNonce(wallet)) + 1;
  const payload = buildTx(wallet, {
    to_:     'stealth',
    amount:  '0',
    ou:      '5000',
    op_type: 'stealth',
  }, nonce);
  return signAndSubmit(wallet, payload);
}
