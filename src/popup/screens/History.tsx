import React, { useEffect, useState } from 'react';
import type { Screen } from '../App';

interface Tx {
  hash: string;
  type: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
  status: string;
}

export default function History({ nav }: { nav: (s: Screen) => void }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_TX_HISTORY' }, (r) => {
      setLoading(false);
      if (r?.txs) setTxs(r.txs);
    });
  }, []);

  const typeIcon = (t: string) => {
    if (t === 'send') return '↑';
    if (t === 'receive') return '↓';
    if (t === 'encrypt') return '🔒';
    if (t === 'decrypt') return '🔓';
    if (t === 'stealth') return '👁️';
    return '•';
  };

  const typeColor = (t: string) => {
    if (t === 'send') return 'text-red-400';
    if (t === 'receive') return 'text-green-400';
    return 'text-purple-400';
  };

  return (
    <div className="flex flex-col h-[580px] bg-gray-950 p-5">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => nav('dashboard')} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-lg font-bold">Transaction History</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : txs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-500">
          <div className="text-4xl">📭</div>
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
          {txs.map((tx) => (
            <div key={tx.hash} className="card flex items-center gap-3">
              <div className={`text-xl w-8 text-center ${typeColor(tx.type)}`}>{typeIcon(tx.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium capitalize">{tx.type}</span>
                  <span className={`text-sm font-semibold ${typeColor(tx.type)}`}>{tx.amount} OCTRA</span>
                </div>
                <p className="text-xs text-gray-500 font-mono truncate">{tx.hash}</p>
                <p className="text-xs text-gray-600">{new Date(tx.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
