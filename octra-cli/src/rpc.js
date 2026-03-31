// RPC client for Octra node — uses native fetch (Node 18+, no dependencies)

let RPC_URL = 'http://46.101.86.250:8080';

export function setRpcUrl(url) { RPC_URL = url.replace(/\/$/, ''); }
export function getRpcUrl() { return RPC_URL; }

async function rpcCall(method, params = [], timeout = 10000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(RPC_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal:  ctrl.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (data.error) throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
    return data.result;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('RPC timeout');
    throw e;
  }
}

export async function getBalance(address) {
  const r = await rpcCall('octra_getBalance', [address]);
  if (r?.balance_raw !== undefined) return (Number(r.balance_raw) / 1e6).toFixed(6);
  if (r?.balance     !== undefined) return String(r.balance);
  return '0';
}

export async function getAccount(address, timeout = 10) {
  return rpcCall('octra_getBalance', [address], timeout * 1000);
}

export async function submitTx(txJson) {
  return rpcCall('octra_sendTransaction', [txJson]);
}

export async function getTransaction(hash) {
  return rpcCall('octra_getTransaction', [hash]);
}

export async function getTxsByAddr(address, limit = 20, offset = 0) {
  return rpcCall('octra_transactionsByAddress', [address, limit, offset]);
}

export async function stagingView() {
  return rpcCall('octra_stagingView', []);
}

export async function getNodeStatus() {
  return rpcCall('octra_getNodeInfo', []);
}

// ─── Pubkey registration ────────────────────────────────────────────────────

export async function getViewPubkey(address) {
  try { return await rpcCall('octra_getViewPubkey', [address], 5000); }
  catch { return null; }
}

export async function registerPublicKey(address, pubKeyB64, signature) {
  return rpcCall('octra_registerPublicKey', [address, pubKeyB64, signature]);
}

export async function rpcRawCall(method, params = []) {
  return rpcCall(method, params);
}
