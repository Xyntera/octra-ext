// Octra RPC client — methods from octra-labs/webcli rpc_client.hpp
const RPC_URL = 'http://46.101.86.250:8080';

async function rpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(`${RPC_URL}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
  });
  const data = await res.json() as { result?: unknown; error?: { message?: string } };
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

// ── Balance & Account ────────────────────────────────────────────────────────

export async function getBalance(address: string): Promise<string> {
  const result = await rpcCall('octra_balance', [address]);
  return String(result ?? '0');
}

export async function getAccount(address: string, limit = 20) {
  return rpcCall('octra_account', [address, limit]);
}

export async function getNonce(address: string): Promise<number> {
  const account = await getAccount(address) as { nonce?: number };
  return account?.nonce ?? 0;
}

export async function getTxsByAddress(address: string, limit = 50, offset = 0) {
  return rpcCall('octra_transactionsByAddress', [address, limit, offset]);
}

export async function getTransaction(hash: string) {
  return rpcCall('octra_transaction', [hash]);
}

// ── Submit Transaction ───────────────────────────────────────────────────────
// Method: octra_submit — params: [txObject]

export async function submitTx(tx: object): Promise<string> {
  const result = await rpcCall('octra_submit', [tx]);
  return String(result);
}

// ── FHE / PVAC ───────────────────────────────────────────────────────────────

export async function getEncryptedBalance(
  address: string,
  sigB64: string,
  pubB64: string
) {
  return rpcCall('octra_encryptedBalance', [address, sigB64, pubB64]);
}

export async function getEncryptedCipher(address: string) {
  return rpcCall('octra_encryptedCipher', [address]);
}

export async function registerPvacPubkey(
  address: string,
  pkB64: string,
  sigB64: string,
  pubB64: string,
  aesKatHex = ''
) {
  return rpcCall('octra_registerPvacPubkey', [address, pkB64, sigB64, pubB64, aesKatHex]);
}

export async function getPvacPubkey(address: string) {
  return rpcCall('octra_pvacPubkey', [address]);
}

// ── Stealth ──────────────────────────────────────────────────────────────────

export async function getStealthOutputs(fromEpoch = 0) {
  return rpcCall('octra_stealthOutputs', [fromEpoch]);
}

export async function getViewPubkey(address: string) {
  return rpcCall('octra_viewPubkey', [address]);
}

export async function registerPublicKey(
  address: string,
  pubB64: string,
  sigB64: string
) {
  return rpcCall('octra_registerPublicKey', [address, pubB64, sigB64]);
}

// ── Staging ──────────────────────────────────────────────────────────────────

export async function stagingView() {
  return rpcCall('staging_view', []);
}

// ── Smart Contracts ──────────────────────────────────────────────────────────

export async function compileAssembly(source: string) {
  return rpcCall('octra_compileAssembly', [source]);
}

export async function compileAml(source: string) {
  return rpcCall('octra_compileAml', [source]);
}

export async function listContracts() {
  return rpcCall('octra_listContracts', []);
}

export async function vmContract(address: string) {
  return rpcCall('vm_contract', [address]);
}

export async function contractReceipt(hash: string) {
  return rpcCall('contract_receipt', [hash]);
}
