import { signMessage, hexToUint8 } from './crypto';
import { getActiveSecretKey } from './wallet';
import { getNonce, broadcastTx, getTransactions } from './rpc';
import type { SendParams, Transaction } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';

export async function buildAndSendTx(from: string, params: SendParams): Promise<{ hash: string }> {
  const sk = await getActiveSecretKey();
  const nonce = await getNonce(from);

  const tx = {
    from,
    to: params.to,
    amount: params.amount,
    fee: params.fee ?? '0.001',
    nonce,
    data: params.data ?? '',
    timestamp: Date.now(),
  };

  const msg = new TextEncoder().encode(JSON.stringify(tx));
  const sig = signMessage(msg, sk);
  const signedTx = { ...tx, signature: Buffer.from(sig).toString('hex') };

  const result = await broadcastTx(Buffer.from(JSON.stringify(signedTx)).toString('hex'));
  await cacheTx(from, { ...signedTx, hash: result.hash, status: 'pending', type: 'send' });
  return result;
}

export async function fetchHistory(address: string): Promise<Transaction[]> {
  const remote = await getTransactions(address);
  const cached = await getCachedTxs(address);

  // Merge: prefer remote data
  const map = new Map<string, Transaction>();
  for (const t of cached) map.set(t.hash, t);
  for (const t of remote) map.set(t.hash, t);

  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}

async function cacheTx(address: string, tx: Omit<Transaction, 'hash'> & { hash: string }): Promise<void> {
  const key = `${STORAGE_KEYS.TX_CACHE}_${address}`;
  const result = await chrome.storage.local.get(key);
  const existing: Transaction[] = result[key] ?? [];
  existing.unshift(tx as Transaction);
  if (existing.length > 100) existing.length = 100;
  await chrome.storage.local.set({ [key]: existing });
}

export async function getCachedTxs(address: string): Promise<Transaction[]> {
  const key = `${STORAGE_KEYS.TX_CACHE}_${address}`;
  const result = await chrome.storage.local.get(key);
  return result[key] ?? [];
}
