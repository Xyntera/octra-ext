export interface WalletAccount {
  address: string;
  publicKey: string;     // hex
  encryptedSk: string;   // encrypted with password
  index: number;
}

export interface Vault {
  mnemonic: string;      // encrypted
  accounts: WalletAccount[];
  activeIndex: number;
  passwordHash: string;
  createdAt: number;
}

export interface WalletState {
  isUnlocked: boolean;
  hasWallet: boolean;
  activeAccount: WalletAccount | null;
  balance: string;
  encBalance: EncryptedBalance | null;
  network: string;
}

export interface EncryptedBalance {
  ciphertext: string;    // hex serialized pvac ciphertext
  pubkey: string;        // hex serialized pvac pubkey
  amount: number;        // decrypted cache (0 if locked)
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  nonce: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'send' | 'receive' | 'encrypt' | 'decrypt' | 'stealth';
  data?: string;
}

export interface StealthMeta {
  ephemeralPub: string;
  stealthAddr: string;
  scanKey: string;
}

export interface RPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SendParams {
  to: string;
  amount: string;
  fee?: string;
  data?: string;
}

export interface EncryptParams {
  amount: number;
}

export interface DecryptParams {
  ciphertextHex: string;
}
