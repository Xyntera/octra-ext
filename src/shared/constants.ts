export const RPC_URL = 'http://46.101.86.250:8080';

export const STORAGE_KEYS = {
  VAULT: 'octra_vault',
  SETTINGS: 'octra_settings',
  TX_CACHE: 'octra_tx_cache',
  STEALTH_CACHE: 'octra_stealth_cache',
} as const;

export const MSG = {
  // Wallet
  GET_STATE:         'GET_STATE',
  UNLOCK:            'UNLOCK',
  LOCK:              'LOCK',
  CREATE_WALLET:     'CREATE_WALLET',
  IMPORT_WALLET:     'IMPORT_WALLET',
  GET_BALANCE:       'GET_BALANCE',
  // Transactions
  SEND_TX:           'SEND_TX',
  GET_HISTORY:       'GET_HISTORY',
  // FHE
  ENCRYPT_BALANCE:   'ENCRYPT_BALANCE',
  DECRYPT_BALANCE:   'DECRYPT_BALANCE',
  GET_ENC_BALANCE:   'GET_ENC_BALANCE',
  // Stealth
  STEALTH_SEND:      'STEALTH_SEND',
  STEALTH_SCAN:      'STEALTH_SCAN',
  // dApp
  DAPP_REQUEST:      'DAPP_REQUEST',
  DAPP_CONNECT:      'DAPP_CONNECT',
  DAPP_SIGN_TX:      'DAPP_SIGN_TX',
} as const;

export const NETWORKS = {
  mainnet: { name: 'Mainnet', rpc: 'http://46.101.86.250:8080' },
} as const;
