import { MSG } from '../shared/constants';
import type { ExtMessage, ExtResponse } from '../shared/messages';
import {
  getState, createWallet, importWallet, unlock, lock,
  isUnlocked, getOrCreateFheKeys
} from './wallet';
import { buildAndSendTx, fetchHistory } from './transactions';
import { pvacEncrypt, pvacDecrypt } from './pvac_wasm';
import { stealthSend, stealthScan } from './stealth';
import { getBalance } from './rpc';

chrome.runtime.onMessage.addListener(
  (message: ExtMessage, _sender, sendResponse: (r: ExtResponse) => void) => {
    handleMessage(message).then(sendResponse).catch((e) =>
      sendResponse({ success: false, error: String(e) })
    );
    return true; // async
  }
);

async function handleMessage(msg: ExtMessage): Promise<ExtResponse> {
  const p = msg.payload as Record<string, unknown> | undefined;

  switch (msg.type) {
    case MSG.GET_STATE:
      return { success: true, data: await getState() };

    case MSG.UNLOCK: {
      const ok = await unlock(p?.password as string);
      return ok ? { success: true, data: await getState() } : { success: false, error: 'Wrong password' };
    }

    case MSG.LOCK:
      lock();
      return { success: true };

    case MSG.CREATE_WALLET: {
      const { mnemonic, address } = await createWallet(p?.password as string);
      return { success: true, data: { mnemonic, address } };
    }

    case MSG.IMPORT_WALLET: {
      const { address } = await importWallet(p?.mnemonic as string, p?.password as string);
      return { success: true, data: { address } };
    }

    case MSG.GET_BALANCE: {
      if (!isUnlocked()) return { success: false, error: 'Locked' };
      const state = await getState();
      const bal = await getBalance(state.activeAccount!.address);
      return { success: true, data: { balance: bal } };
    }

    case MSG.SEND_TX: {
      if (!isUnlocked()) return { success: false, error: 'Locked' };
      const state = await getState();
      const result = await buildAndSendTx(state.activeAccount!.address, p as never);
      return { success: true, data: result };
    }

    case MSG.GET_HISTORY: {
      if (!isUnlocked()) return { success: false, error: 'Locked' };
      const state = await getState();
      const txs = await fetchHistory(state.activeAccount!.address);
      return { success: true, data: txs };
    }

    case MSG.ENCRYPT_BALANCE: {
      if (!isUnlocked()) return { success: false, error: 'Locked' };
      const { pubHex } = await getOrCreateFheKeys();
      const ctHex = await pvacEncrypt(pubHex, p?.amount as number);
      return { success: true, data: { ciphertextHex: ctHex, pubHex } };
    }

    case MSG.DECRYPT_BALANCE: {
      if (!isUnlocked()) return { success: false, error: 'Locked' };
      const { pubHex, secHex } = await getOrCreateFheKeys();
      const value = await pvacDecrypt(pubHex, secHex, p?.ciphertextHex as string);
      return { success: true, data: { value } };
    }

    case MSG.GET_ENC_BALANCE:
      return { success: true, data: null }; // placeholder

    case MSG.STEALTH_SEND: {
      if (!isUnlocked()) return { success: false, error: 'Locked' };
      const state = await getState();
      const res = await stealthSend(
        state.activeAccount!.address,
        p?.viewPub as string,
        p?.spendPub as string,
        p?.amount as string
      );
      return { success: true, data: res };
    }

    case MSG.STEALTH_SCAN: {
      if (!isUnlocked()) return { success: false, error: 'Locked' };
      const state = await getState();
      const found = await stealthScan(state.activeAccount!.address);
      return { success: true, data: found };
    }

    default:
      return { success: false, error: `Unknown message type: ${msg.type}` };
  }
}

// Keep service worker alive during long operations
chrome.runtime.onInstalled.addListener(() => {
  console.log('Octra Wallet installed');
});
