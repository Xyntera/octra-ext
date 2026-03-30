import React, { useState } from 'react';
import type { Screen } from '../App';

export default function Send({ nav }: { nav: (s: Screen) => void }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  const handleSend = () => {
    if (!to || !amount) return;
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'SEND_TX', to, amount: parseFloat(amount), memo }, (r) => {
      setLoading(false);
      setResult(r);
    });
  };

  return (
    <div className="flex flex-col h-[580px] bg-gray-950 p-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('dashboard')} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-lg font-bold">Send OCTRA</h1>
      </div>

      {result ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          {result.success ? (
            <>
              <div className="text-5xl">✅</div>
              <p className="font-semibold">Transaction Sent!</p>
              <p className="text-xs text-gray-400 font-mono break-all text-center">{result.txHash}</p>
            </>
          ) : (
            <>
              <div className="text-5xl">❌</div>
              <p className="text-red-400">{result.error}</p>
            </>
          )}
          <button className="btn-primary" onClick={() => { setResult(null); nav('dashboard'); }}>Back to Dashboard</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Recipient Address</label>
            <input className="input-field" placeholder="oct1…" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Amount (OCTRA)</label>
            <input className="input-field" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Memo (optional)</label>
            <input className="input-field" placeholder="Optional message" value={memo} onChange={e => setMemo(e.target.value)} />
          </div>
          <button className="btn-primary mt-auto" onClick={handleSend} disabled={loading || !to || !amount}>
            {loading ? 'Sending…' : `Send ${amount || '0'} OCTRA`}
          </button>
        </div>
      )}
    </div>
  );
}
