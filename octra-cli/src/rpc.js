// RPC client — method names & path from octra-labs/webcli rpc_client.hpp
// Path is /rpc (NOT /), methods are camelCase octra_* names

let RPC_URL = 'http://46.101.86.250:8080';

function buildEndpoint(base) {
  const url = base.replace(/\/$/, '');
  // If URL already has a path (e.g. /rpc), use it; otherwise append /rpc
  try {
    const u = new URL(url);
    if (u.pathname === '/' || u.pathname === '') u.pathname = '/rpc';
    return u.toString();
  } catch {
    return url + '/rpc';
  }
}

export function setRpcUrl(url) { RPC_URL = url.replace(/\/$/, ''); }
export function getRpcUrl() { return RPC_URL; }

let _reqId = 0;

async function rpcCall(method, params = [], timeout = 15000) {
  const endpoint = buildEndpoint(RPC_URL);
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: ++_reqId, method, params }),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (data.error) {
      const msg = typeof data.error === 'object'
        ? (data.error.message || JSON.stringify(data.error))
        : String(data.error);
      throw new Error(`RPC error: ${msg}`);
    }
    return data.result;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('RPC timeout');
    throw e;
  }
}

// ─── Node info ───────────────────────────────────────────────────────────────
export async function getNodeStatus() {
  return rpcCall('octra_nodeInfo', []);
}

// ─── Balance ──────────────────────────────────────────────────────────────────
export async function getBalance(address) {
  // octra_balance returns { balance, balance_raw, nonce, ... }
  const r = await rpcCall('octra_balance', [address]);
  if (r?.balance_raw !== undefined) return (Number(r.balance_raw) / 1e6).toFixed(6);
  if (r?.balance     !== undefined) return String(r.balance);
  return '0';
}

export async function getAccount(address, timeout = 10) {
  // octra_account returns full account info including pending_nonce
  return rpcCall('octra_account', [address, 1], timeout * 1000);
}

// ─── Transactions ──────────────────────────────────────────────────────────
export async function submitTx(txJson) {
  // octra_submit wraps tx in array
  const r = await rpcCall('octra_submit', [txJson]);
  // Response: { tx_hash } or { hash }
  return r?.tx_hash ?? r?.hash ?? r;
}

export async function getTransaction(hash) {
  return rpcCall('octra_transaction', [hash]);
}

export async function getTxsByAddr(address, limit = 20, offset = 0) {
  return rpcCall('octra_transactionsByAddress', [address, limit, offset]);
}

export async function stagingView() {
  return rpcCall('staging_view', [], 5000);
}

// ─── Pubkey registration ────────────────────────────────────────────────────
export async function getViewPubkey(address) {
  try { return await rpcCall('octra_viewPubkey', [address], 5000); }
  catch { return null; }
}

export async function registerPublicKey(address, pubKeyB64, signature) {
  return rpcCall('octra_registerPublicKey', [address, pubKeyB64, signature]);
}

// ─── FHE / Encrypted balance ─────────────────────────────────────────────────
export async function getEncryptedBalance(address, signature, pubKeyB64) {
  return rpcCall('octra_encryptedBalance', [address, signature, pubKeyB64]);
}

export async function getEncryptedCipher(address) {
  return rpcCall('octra_encryptedCipher', [address]);
}

// ─── Stealth ──────────────────────────────────────────────────────────────────
export async function getStealthOutputs(fromEpoch = 0) {
  const r = await rpcCall('octra_stealthOutputs', [fromEpoch]);
  if (Array.isArray(r)) return r;
  return r?.outputs ?? r?.items ?? [];
}

// ─── Generic raw call ──────────────────────────────────────────────────────────
export async function rpcRawCall(method, params = []) {
  return rpcCall(method, params);
}
