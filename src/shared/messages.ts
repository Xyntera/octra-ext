import { MSG } from './constants';

export type MsgType = typeof MSG[keyof typeof MSG];

export interface ExtMessage {
  type: MsgType;
  payload?: unknown;
  id?: string;
}

export interface ExtResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  id?: string;
}

export function sendToBackground(msg: ExtMessage): Promise<ExtResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response: ExtResponse) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: 'No response' });
      }
    });
  });
}
