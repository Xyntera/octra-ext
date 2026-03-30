import { RPC_URL } from '../shared/constants';
import type { Transaction } from '../shared/types';

const BASE = RPC_URL;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`RPC error ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC error ${res.status}: ${path}`);
  return res.json();
}

export async function getBalance(address: string): Promise<string> {
  try {
    const data = await get<{ balance?: string; amount?: string }>(`/balance/${address}`);
    return data.balance ?? data.amount ?? '0';
  } catch {
    return '0';
  }
}

export async function getNonce(address: string): Promise<number> {
  try {
    const data = await get<{ nonce?: number }>(`/nonce/${address}`);
    return data.nonce ?? 0;
  } catch {
    return 0;
  }
}

export async function broadcastTx(txHex: string): Promise<{ hash: string }> {
  return post<{ hash: string }>('/broadcast', { tx: txHex });
}

export async function getTransaction(hash: string): Promise<Transaction | null> {
  try {
    return await get<Transaction>(`/tx/${hash}`);
  } catch {
    return null;
  }
}

export async function getTransactions(address: string, limit = 20): Promise<Transaction[]> {
  try {
    const data = await get<{ transactions?: Transaction[] }>(`/transactions/${address}?limit=${limit}`);
    return data.transactions ?? [];
  } catch {
    return [];
  }
}

export async function getNetworkInfo(): Promise<{ height: number; peers: number }> {
  try {
    return await get<{ height: number; peers: number }>('/info');
  } catch {
    return { height: 0, peers: 0 };
  }
}
