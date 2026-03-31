// Octra RPC Client — mirrors octra-labs/webcli rpc_client.hpp

const DEFAULT_RPC = 'http://46.101.86.250:8080';

let _rpcUrl = DEFAULT_RPC;

export function setRpcUrl(url) {
  _rpcUrl = url.replace(/\/$/, '');
}

export function getRpcUrl() {
  return _rpcUrl;
}

let _reqId = 1;

async function call(method, params = [], timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${_rpcUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: _reqId++ }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (data.error) {
      const msg = typeof data.error === 'object'
        ? (data.error.message || JSON.stringify(data.error))
        : String(data.error);
      throw new Error(`RPC error: ${msg}`);
    }
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

// ── Balance & Account ────────────────────────────────────────────────────────
export const getBalance     = (addr)               => call('octra_balance', [addr]);
export const getAccount     = (addr, limit = 20)   => call('octra_account', [addr, limit]);
export const getTransaction = (hash)               => call('octra_transaction', [hash]);
export const getTxsByAddr   = (addr, limit = 50, offset = 0) =>
                                call('octra_transactionsByAddress', [addr, limit, offset]);

// ── Submit ───────────────────────────────────────────────────────────────────
export const submitTx       = (tx)                 => call('octra_submit', [tx]);

// ── FHE / PVAC ──────────────────────────────────────────────────────────────
export const getEncryptedBalance  = (addr, sigB64, pubB64) =>
                                      call('octra_encryptedBalance', [addr, sigB64, pubB64]);
export const getEncryptedCipher   = (addr)               => call('octra_encryptedCipher', [addr]);
export const registerPvacPubkey   = (addr, pkB64, sigB64, pubB64, aesKatHex = '') =>
                                      call('octra_registerPvacPubkey', [addr, pkB64, sigB64, pubB64, aesKatHex]);
export const getPvacPubkey        = (addr)               => call('octra_pvacPubkey', [addr]);

// ── Stealth ──────────────────────────────────────────────────────────────────
export const getStealthOutputs  = (fromEpoch = 0) => call('octra_stealthOutputs', [fromEpoch]);
export const getViewPubkey      = (addr)          => call('octra_viewPubkey', [addr]);
export const registerPublicKey  = (addr, pubB64, sigB64) =>
                                    call('octra_registerPublicKey', [addr, pubB64, sigB64]);

// ── Staging ──────────────────────────────────────────────────────────────────
export const stagingView = () => call('staging_view', [], 5000);

// ── Smart Contracts ──────────────────────────────────────────────────────────
export const compileAssembly     = (src)       => call('octra_compileAssembly', [src], 10000);
export const compileAml          = (src)       => call('octra_compileAml', [src], 10000);
export const listContracts       = ()          => call('octra_listContracts', [], 10000);
export const vmContract          = (addr)      => call('vm_contract', [addr]);
export const contractReceipt     = (hash)      => call('contract_receipt', [hash]);
export const contractAbi         = (addr)      => call('octra_contractAbi', [addr]);
export const contractStorage     = (addr, key) => call('octra_contractStorage', [addr, key]);
