// Transaction builder — exact match of octra-labs/webcli lib/tx_builder.hpp
//
// canonical_json FIXED key order: from, to_, amount, nonce, ou, timestamp, op_type
// signing: Ed25519(raw canonical_json UTF-8 bytes)  — NO sha256 pre-hash
// amount: raw int64 string (1 OCTRA = 1000000)
// timestamp: serialized once via formatTimestamp(), embedded verbatim everywhere

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

// Mirrors format_timestamp() in tx_builder.hpp:
//   nlohmann::json j = ts; return j.dump();
// Both nlohmann (Grisu2) and JS (Grisu3/Dragon4) produce the shortest
// round-trip decimal representation of the IEEE 754 double.
// String(ts) in JS == nlohmann j.dump() for the same double value.
function formatTimestamp(ts) {
  const s = String(ts);
  // nlohmann always emits a decimal point for doubles
  return s.includes('.') ? s : s + '.0';
}

// Mirrors json_escape() in tx_builder.hpp
function jsonEscape(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g,  '\\"')
    .replace(/\b/g, '\\b')
    .replace(/\f/g, '\\f')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Exact replica of canonical_json() from tx_builder.hpp
// timestampStr is embedded verbatim — never re-parsed as a float
function canonicalJson(tx) {
  let s = `{"from":"${tx.from}"`
         + `,"to_":"${tx.to_}"`
         + `,"amount":"${tx.amount}"`
         + `,"nonce":${tx.nonce}`
         + `,"ou":"${tx.ou}"`
         + `,"timestamp":${tx.timestampStr}`
         + `,"op_type":"${tx.op_type || 'standard'}"`;
  if (tx.encrypted_data) s += `,"encrypted_data":"${jsonEscape(tx.encrypted_data)}"`;
  if (tx.message)        s += `,"message":"${jsonEscape(tx.message)}"`;
  s += '}';
  return s;
}

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
  const nonce        = (await getNonce(wallet)) + 1;
  const timestampStr = formatTimestamp(Date.now() / 1000);

  const tx = {
    from:         wallet.address,
    to_:          fields.to_,
    amount:       fields.amount,
    nonce,
    ou:           fields.ou,
    timestampStr, // verbatim in canonical JSON and in submit body
    op_type:      fields.op_type || 'standard',
    ...(fields.encrypted_data ? { encrypted_data: fields.encrypted_data } : {}),
    ...(fields.message        ? { message: fields.message }               : {}),
  };

  const canon    = canonicalJson(tx);
  const msgBytes = Buffer.from(canon, 'utf8');

  process.stderr.write(`[tx] signing: ${canon}\n`);

  const signature = await signBytes(msgBytes, wallet.privKeyB64);

  // submitTx receives timestampStr so rpc.js can embed it verbatim
  return submitTx({
    from:         tx.from,
    to_:          tx.to_,
    amount:       tx.amount,
    nonce:        tx.nonce,
    ou:           tx.ou,
    timestampStr, // rpc.js splices this in raw
    op_type:      tx.op_type,
    signature,
    public_key:   wallet.pubKeyB64,
    ...(tx.encrypted_data ? { encrypted_data: tx.encrypted_data } : {}),
    ...(tx.message        ? { message: tx.message }               : {}),
  });
}

export async function sendTransfer(wallet, to, amount, memo = '') {
  const raw = toRaw(amount);
  const ou  = raw < 1_000_000_000n ? '10000' : '30000';
  return buildSignSubmit(wallet, {
    to_: to, amount: String(raw), ou, op_type: 'standard',
    ...(memo ? { message: memo } : {}),
  });
}

export async function sendBatch(wallet, recipients) {
  let nonce = (await getNonce(wallet)) + 1;
  const results = [];
  for (const r of recipients) {
    const raw          = toRaw(r.amount);
    const ou           = raw < 1_000_000_000n ? '10000' : '30000';
    const timestampStr = formatTimestamp(Date.now() / 1000);
    const tx = {
      from: wallet.address, to_: r.to, amount: String(raw),
      nonce, ou, timestampStr, op_type: 'standard',
      ...(r.memo ? { message: r.memo } : {}),
    };
    const canon     = canonicalJson(tx);
    const msgBytes  = Buffer.from(canon, 'utf8');
    const signature = await signBytes(msgBytes, wallet.privKeyB64);
    results.push(await submitTx({
      from: tx.from, to_: tx.to_, amount: tx.amount,
      nonce: tx.nonce, ou: tx.ou, timestampStr,
      op_type: tx.op_type, signature, public_key: wallet.pubKeyB64,
      ...(tx.message ? { message: tx.message } : {}),
    }));
    nonce++;
  }
  return results;
}

export async function encryptBalance(wallet, amount) {
  const raw = toRaw(amount);
  return buildSignSubmit(wallet, {
    to_: wallet.address, amount: String(raw), ou: '10000', op_type: 'encrypt',
  });
}

export async function decryptBalance(wallet, amount) {
  const raw = toRaw(amount);
  return buildSignSubmit(wallet, {
    to_: wallet.address, amount: String(raw), ou: '10000', op_type: 'decrypt',
  });
}

export async function stealthSend(wallet, recipientAddr, amount) {
  return buildSignSubmit(wallet, {
    to_: 'stealth', amount: '0', ou: '5000', op_type: 'stealth',
  });
}
