// Transaction builder — exact match of octra-labs/webcli lib/tx_builder.hpp
//
// canonical_json FIXED key order: from, to_, amount, nonce, ou, timestamp, op_type
// signing: Ed25519(raw canonical_json UTF-8 bytes)  — NO sha256 pre-hash
// amount: raw int64 string (1 OCTRA = 1000000)
// timestamp: float seconds

import { signBytes } from './crypto.js';
import { submitTx, getAccount, stagingView } from './rpc.js';

const MU = 1_000_000n;

export function toRaw(amount) {
  const [int, frac = ''] = String(amount).split('.');
  const fp = frac.padEnd(6, '0').slice(0, 6);
  return BigInt(int) * MU + BigInt(fp);
}

export function fromRaw(raw) {
  return (Number(BigInt(raw)) / 1_000_000).toFixed(6);
}

// Exact replica of canonical_json() from tx_builder.hpp
// Key order is HARDCODED (not alphabetical)
function canonicalJson(tx) {
  let s = `{"from":"${tx.from}"`
         + `,"to_":"${tx.to_}"`
         + `,"amount":"${tx.amount}"`
         + `,"nonce":${tx.nonce}`
         + `,"ou":"${tx.ou}"`
         + `,"timestamp":${tx.timestamp}`
         + `,"op_type":"${tx.op_type || 'standard'}"`;
  if (tx.encrypted_data) s += `,"encrypted_data":"${tx.encrypted_data}"`;
  if (tx.message)        s += `,"message":"${tx.message}"`;
  s += '}';
  return s;
}

// Get max nonce from chain + staging pool
export async function getNonce(wallet) {
  try {
    const acc   = await getAccount(wallet.address);
    let nonce   = acc?.pending_nonce ?? acc?.nonce ?? 0;
    try {
      const sv  = await stagingView();
      const txs = Array.isArray(sv) ? sv : (sv?.transactions ?? sv?.txs ?? []);
      for (const t of txs) {
        if (t.from === wallet.address && t.nonce > nonce) nonce = t.nonce;
      }
    } catch { /* staging optional */ }
    return nonce;
  } catch { return 0; }
}

async function buildSignSubmit(wallet, fields) {
  const nonce = (await getNonce(wallet)) + 1;

  const tx = {
    from:      wallet.address,
    to_:       fields.to_,
    amount:    fields.amount,
    nonce,
    ou:        fields.ou,
    timestamp: Date.now() / 1000,
    op_type:   fields.op_type || 'standard',
    ...(fields.encrypted_data ? { encrypted_data: fields.encrypted_data } : {}),
    ...(fields.message        ? { message: fields.message }               : {}),
  };

  const canon     = canonicalJson(tx);
  const msgBytes  = Buffer.from(canon, 'utf8');

  // Debug: print canonical JSON being signed
  process.stderr.write(`[tx] signing: ${canon}\n`);

  const signature = await signBytes(msgBytes, wallet.privKeyB64);

  // Submit body includes all tx fields + signature + public_key
  const submitBody = {
    from:       tx.from,
    to_:        tx.to_,
    amount:     tx.amount,
    nonce:      tx.nonce,
    ou:         tx.ou,
    timestamp:  tx.timestamp,
    op_type:    tx.op_type,
    signature,
    public_key: wallet.pubKeyB64,
    ...(tx.encrypted_data ? { encrypted_data: tx.encrypted_data } : {}),
    ...(tx.message        ? { message: tx.message }               : {}),
  };

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
    const canon     = canonicalJson(tx);
    const msgBytes  = Buffer.from(canon, 'utf8');
    const signature = await signBytes(msgBytes, wallet.privKeyB64);
    const body = { ...tx, signature, public_key: wallet.pubKeyB64 };
    results.push(await submitTx(body));
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
