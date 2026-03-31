// Transaction builder — mirrors webcli main.cpp send/encrypt/decrypt logic

import { signTx } from './crypto.js';
import { submitTx, getAccount } from './rpc.js';

// ── Build & Sign ──────────────────────────────────────────────────────────────

async function buildAndSign(wallet, txFields) {
  const account = await getAccount(wallet.address);
  const nonce = (account?.nonce ?? 0) + 1;

  const payload = {
    from:   wallet.address,
    nonce,
    ...txFields,
    timestamp: Date.now(),
  };

  const signature = await signTx(payload, wallet.privKeyB64);

  return {
    ...payload,
    pub:  wallet.pubKeyB64,
    sig:  signature,
  };
}

// ── Standard Transfer ─────────────────────────────────────────────────────────

export async function sendTransfer(wallet, to, amount, memo = '') {
  const tx = await buildAndSign(wallet, {
    to,
    amount: String(amount),
    ...(memo ? { memo } : {}),
  });
  return submitTx(tx);
}

// ── Batch Transfer ────────────────────────────────────────────────────────────

export async function sendBatch(wallet, recipients) {
  // recipients: [{ to, amount, memo? }]
  const account = await getAccount(wallet.address);
  let nonce = (account?.nonce ?? 0) + 1;
  const results = [];
  for (const r of recipients) {
    const payload = {
      from:   wallet.address,
      nonce,
      to:     r.to,
      amount: String(r.amount),
      timestamp: Date.now(),
      ...(r.memo ? { memo: r.memo } : {}),
    };
    const signature = await signTx(payload, wallet.privKeyB64);
    const tx = { ...payload, pub: wallet.pubKeyB64, sig: signature };
    results.push(await submitTx(tx));
    nonce++;
  }
  return results;
}

// ── Encrypt Balance (FHE) ─────────────────────────────────────────────────────

export async function encryptBalance(wallet, amount) {
  const tx = await buildAndSign(wallet, {
    type:   'encrypt',
    amount: String(amount),
  });
  return submitTx(tx);
}

// ── Decrypt Balance (FHE) ─────────────────────────────────────────────────────

export async function decryptBalance(wallet, amount) {
  const tx = await buildAndSign(wallet, {
    type:   'decrypt',
    amount: String(amount),
  });
  return submitTx(tx);
}

// ── Stealth Send ──────────────────────────────────────────────────────────────

export async function stealthSend(wallet, recipientAddr, amount) {
  const tx = await buildAndSign(wallet, {
    type:   'stealth',
    to:     recipientAddr,
    amount: String(amount),
  });
  return submitTx(tx);
}
