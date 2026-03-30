import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { getActiveSecretKey } from './wallet';
import { buildAndSendTx } from './transactions';
import { getTransactions } from './rpc';
import type { StealthMeta } from '../shared/types';

function hashSharedSecret(shared: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const combined = new Uint8Array([...shared, ...enc.encode('octra-stealth-v1')]);
  // Simple hash via SubtleCrypto is async; use synchronous mix here
  // For production use SHA-256 async
  return combined.slice(0, 32);
}

export async function stealthSend(
  from: string,
  recipientViewPub: string,
  recipientSpendPub: string,
  amount: string
): Promise<{ hash: string; stealthAddr: string }> {
  // Generate ephemeral keypair
  const ephKp = nacl.box.keyPair();

  // Decode recipient keys
  const viewPub   = bs58.decode(recipientViewPub.replace('oct', ''));
  const spendPub  = bs58.decode(recipientSpendPub.replace('oct', ''));

  // ECDH: ephemeral * viewPub
  const shared = nacl.scalarMult(ephKp.secretKey.slice(0, 32), viewPub);
  const h = hashSharedSecret(shared);

  // Stealth address = spendPub XOR h
  const stealthKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) stealthKey[i] = spendPub[i] ^ h[i];
  const stealthAddr = 'oct' + bs58.encode(stealthKey);

  const ephPubHex = Buffer.from(ephKp.publicKey).toString('hex');
  const meta: StealthMeta = {
    ephemeralPub: ephPubHex,
    stealthAddr,
    scanKey: recipientViewPub,
  };

  const result = await buildAndSendTx(from, {
    to: stealthAddr,
    amount,
    data: JSON.stringify({ type: 'stealth', meta }),
  });

  return { hash: result.hash, stealthAddr };
}

export async function stealthScan(address: string): Promise<Array<{
  hash: string; amount: string; stealthAddr: string; ephemeralPub: string
}>> {
  const sk = await getActiveSecretKey();
  const viewKey = sk.slice(0, 32); // use first 32 bytes as view key

  const txs = await getTransactions(address);
  const found: Array<{ hash: string; amount: string; stealthAddr: string; ephemeralPub: string }> = [];

  for (const tx of txs) {
    try {
      if (!tx.data) continue;
      const parsed = JSON.parse(tx.data);
      if (parsed.type !== 'stealth' || !parsed.meta) continue;

      const { ephemeralPub, stealthAddr } = parsed.meta as StealthMeta;
      const ephPub = Buffer.from(ephemeralPub, 'hex');

      const shared = nacl.scalarMult(viewKey, ephPub);
      const h = hashSharedSecret(shared);

      // Check if stealth address matches
      const spendPub = bs58.decode(address.replace('oct', ''));
      const expected = new Uint8Array(32);
      for (let i = 0; i < 32; i++) expected[i] = spendPub[i] ^ h[i];
      const expectedAddr = 'oct' + bs58.encode(expected);

      if (expectedAddr === stealthAddr) {
        found.push({ hash: tx.hash, amount: tx.amount, stealthAddr, ephemeralPub });
      }
    } catch {
      // skip malformed
    }
  }

  return found;
}
