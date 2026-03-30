import { STORAGE_KEYS } from '../shared/constants';
import type { Vault, WalletAccount, WalletState } from '../shared/types';
import {
  generateMnemonic12, validateMnemonicWords, seedFromMnemonic,
  keypairFromSeed, addressFromPublicKey, publicKeyHex, secretKeyHex,
  encryptWithPassword, decryptWithPassword, hashPassword, hexToUint8
} from './crypto';
import { pvacKeygen } from './pvac_wasm';
import { getBalance } from './rpc';

let _vault: Vault | null = null;
let _password: string | null = null;

export function isUnlocked(): boolean {
  return _vault !== null && _password !== null;
}

export async function hasWallet(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
  return !!result[STORAGE_KEYS.VAULT];
}

export async function getState(): Promise<WalletState> {
  const hw = await hasWallet();
  if (!isUnlocked() || !_vault) {
    return { isUnlocked: false, hasWallet: hw, activeAccount: null, balance: '0', encBalance: null, network: 'mainnet' };
  }
  const account = _vault.accounts[_vault.activeIndex];
  const balance = await getBalance(account.address).catch(() => '0');
  const encResult = await chrome.storage.local.get(STORAGE_KEYS.STEALTH_CACHE);
  const encBalance = encResult[STORAGE_KEYS.STEALTH_CACHE]?.[account.address] ?? null;
  return { isUnlocked: true, hasWallet: hw, activeAccount: account, balance, encBalance, network: 'mainnet' };
}

export async function createWallet(password: string): Promise<{ mnemonic: string; address: string }> {
  const mnemonic = generateMnemonic12();
  const seed = seedFromMnemonic(mnemonic);
  const kp = keypairFromSeed(seed);
  const address = addressFromPublicKey(kp.publicKey);
  const pubKey = publicKeyHex(kp.publicKey);

  const encMnemonic = await encryptWithPassword(mnemonic, password);
  const encSk = await encryptWithPassword(secretKeyHex(kp.secretKey), password);
  const pwHash = await hashPassword(password);

  const account: WalletAccount = { address, publicKey: pubKey, encryptedSk: encSk, index: 0 };
  const vault: Vault = {
    mnemonic: encMnemonic,
    accounts: [account],
    activeIndex: 0,
    passwordHash: pwHash,
    createdAt: Date.now(),
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: JSON.stringify(vault) });
  _vault = vault;
  _password = password;

  return { mnemonic, address };
}

export async function importWallet(mnemonic: string, password: string): Promise<{ address: string }> {
  if (!validateMnemonicWords(mnemonic)) throw new Error('Invalid mnemonic');

  const seed = seedFromMnemonic(mnemonic);
  const kp = keypairFromSeed(seed);
  const address = addressFromPublicKey(kp.publicKey);
  const pubKey = publicKeyHex(kp.publicKey);

  const encMnemonic = await encryptWithPassword(mnemonic, password);
  const encSk = await encryptWithPassword(secretKeyHex(kp.secretKey), password);
  const pwHash = await hashPassword(password);

  const account: WalletAccount = { address, publicKey: pubKey, encryptedSk: encSk, index: 0 };
  const vault: Vault = {
    mnemonic: encMnemonic,
    accounts: [account],
    activeIndex: 0,
    passwordHash: pwHash,
    createdAt: Date.now(),
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: JSON.stringify(vault) });
  _vault = vault;
  _password = password;

  return { address };
}

export async function unlock(password: string): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
  if (!result[STORAGE_KEYS.VAULT]) return false;

  const vault: Vault = JSON.parse(result[STORAGE_KEYS.VAULT]);
  const pwHash = await hashPassword(password);
  if (pwHash !== vault.passwordHash) return false;

  _vault = vault;
  _password = password;
  return true;
}

export function lock(): void {
  _vault = null;
  _password = null;
}

export async function getActiveSecretKey(): Promise<Uint8Array> {
  if (!_vault || !_password) throw new Error('Wallet locked');
  const account = _vault.accounts[_vault.activeIndex];
  const skHex = await decryptWithPassword(account.encryptedSk, _password);
  return hexToUint8(skHex);
}

export async function getActiveMnemonic(): Promise<string> {
  if (!_vault || !_password) throw new Error('Wallet locked');
  return decryptWithPassword(_vault.mnemonic, _password);
}

export async function getOrCreateFheKeys(): Promise<{ pubHex: string; secHex: string }> {
  if (!_vault || !_password) throw new Error('Wallet locked');
  const account = _vault.accounts[_vault.activeIndex];
  const storeKey = `fhe_${account.address}`;
  const result = await chrome.storage.local.get(storeKey);

  if (result[storeKey]) {
    const enc = result[storeKey];
    const secHex = await decryptWithPassword(enc.encSecHex, _password);
    return { pubHex: enc.pubHex, secHex };
  }

  // Derive FHE seed from signing key
  const sk = await getActiveSecretKey();
  const seedHex = Buffer.from(sk.slice(0, 32)).toString('hex');
  const { pubHex, secHex } = await pvacKeygen(seedHex);

  const encSecHex = await encryptWithPassword(secHex, _password);
  await chrome.storage.local.set({ [storeKey]: { pubHex, encSecHex } });

  return { pubHex, secHex };
}
