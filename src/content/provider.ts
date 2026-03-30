// Injected into every page — bridges dApps to the extension

const OCTRA_EXT_ID = chrome.runtime.id;

interface OctraProvider {
  isOctra: boolean;
  version: string;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

const listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

function emit(event: string, ...args: unknown[]) {
  listeners.get(event)?.forEach(fn => fn(...args));
}

const octraProvider: OctraProvider = {
  isOctra: true,
  version: '1.0.0',

  async request({ method, params = [] }) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'DAPP_REQUEST', payload: { method, params } },
        (response) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
          if (!response?.success) return reject(response?.error ?? 'Unknown error');
          resolve(response.data);
        }
      );
    });
  },

  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
  },

  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },
};

// Inject into window
(window as unknown as Record<string, unknown>).octra = octraProvider;
(window as unknown as Record<string, unknown>).octraProvider = octraProvider;

// Listen for events from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ACCOUNT_CHANGED') emit('accountChanged', msg.payload);
  if (msg.type === 'NETWORK_CHANGED') emit('networkChanged', msg.payload);
  if (msg.type === 'DISCONNECT') emit('disconnect');
});
