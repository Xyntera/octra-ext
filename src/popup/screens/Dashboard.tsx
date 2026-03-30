import React, { useEffect, useState } from 'react';
import type { Screen } from '../App';

interface WalletInfo {
  address: string;
  balance: string;
  encrypted_balance: string | null;
  nonce: number;
}

export default function Dashboard({ nav }: { nav: (s: Screen) => void }) {
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'GET_WALLET_INFO' }, (r) => {
      setLoading(false);
      if (r?.address) setInfo(r);
    });
  };

  useEffect(() => { refresh(); }, []);

  const copyAddress = () => {
    if (!info) return;
    navigator.clipboard.writeText(info.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const short = (a: string) => a ? `${a.slice(0, 8)}…${a.slice(-6)}` : '';

  return (
    <div className="flex flex-col h-[580px] bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold">O</div>
          <span className="font-semibold">Octra Wallet</span>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="text-gray-400 hover:text-white text-lg" title="Refresh">↻</button>
          <button onClick={() => nav('settings')} className="text-gray-400 hover:text-white text-lg" title="Settings">⚙</button>
        </div>
      </div>

      {/* Balance card */}
      <div className="mx-5 bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border border-indigo-800/50 rounded-2xl p-4 mb-4">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-xs mb-1">Total Balance</p>
            <p className="text-3xl font-bold mb-1">{info?.balance ?? '0'} <span className="text-lg text-gray-400">OCTRA</span></p>
            {info?.encrypted_balance && (
              <p className="text-xs text-purple-300">🔒 Encrypted: {info.encrypted_balance} OCTRA</p>
            )}
            <button onClick={copyAddress} className="mt-2 text-xs text-gray-400 hover:text-white font-mono">
              {copied ? '✓ Copied!' : short(info?.address || '')}
            </button>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 px-5 mb-4">
        <button onClick={() => nav('send')} className="card hover:border-indigo-600 transition-colors text-center py-3">
          <div className="text-2xl mb-1">↑</div>
          <div className="text-sm font-medium">Send</div>
        </button>
        <button onClick={() => nav('history')} className="card hover:border-indigo-600 transition-colors text-center py-3">
          <div className="text-2xl mb-1">📋</div>
          <div className="text-sm font-medium">History</div>
        </button>
        <button onClick={() => nav('encrypt')} className="card hover:border-purple-600 transition-colors text-center py-3">
          <div className="text-2xl mb-1">🔒</div>
          <div className="text-sm font-medium">Encrypt</div>
        </button>
        <button onClick={() => nav('decrypt')} className="card hover:border-purple-600 transition-colors text-center py-3">
          <div className="text-2xl mb-1">🔓</div>
          <div className="text-sm font-medium">Decrypt</div>
        </button>
      </div>

      {/* Stealth */}
      <div className="px-5">
        <button onClick={() => nav('stealth')} className="card hover:border-cyan-600 transition-colors w-full flex items-center gap-3 py-3">
          <div className="text-2xl">👁️</div>
          <div className="text-left">
            <div className="text-sm font-medium">Stealth Transactions</div>
            <div className="text-xs text-gray-500">Send & receive privately</div>
          </div>
        </button>
      </div>
    </div>
  );
}
