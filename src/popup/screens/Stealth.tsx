import React, { useState } from 'react';
import type { Screen } from '../App';

export default function Stealth({ nav }: { nav: (s: Screen) => void }) {
  const [tab, setTab] = useState<'send' | 'scan'>('send');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);

  const handleStealthSend = () => {
    if (!to || !amount) return;
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'STEALTH_SEND', to, amount: parseFloat(amount) }, (r) => {
      setLoading(false);
      setResult(r);
    });
  };

  const handleScan = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'STEALTH_SCAN' }, (r) => {
      setLoading(false);
      setClaims(r?.claims || []);
    });
  };

  const handleClaim = (claim: any) => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'STEALTH_CLAIM', claim }, (r) => {
      setLoading(false);
      setResult(r);
    });
  };

  return (
    <div className="flex flex-col h-[580px] bg-gray-950 p-5">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => nav('dashboard')} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-lg font-bold">Stealth Transactions</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('send')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'send' ? 'bg-cyan-700 text-white' : 'bg-gray-900 text-gray-400'}`}>Send</button>
        <button onClick={() => setTab('scan')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'scan' ? 'bg-cyan-700 text-white' : 'bg-gray-900 text-gray-400'}`}>Scan & Claim</button>
      </div>

      {tab === 'send' && (
        <div className="flex flex-col gap-4 flex-1">
          {result ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4">
              {result.success ? (
                <><div className="text-5xl">👁️</div><p className="font-semibold">Stealth Sent!</p><p className="text-xs text-gray-400 font-mono break-all text-center">{result.txHash}</p></>
              ) : (
                <><div className="text-5xl">❌</div><p className="text-red-400">{result.error}</p></>
              )}
              <button className="btn-primary" onClick={() => setResult(null)}>Send Another</button>
            </div>
          ) : (
            <>
              <input className="input-field" placeholder="Recipient address (oct1…)" value={to} onChange={e => setTo(e.target.value)} />
              <input className="input-field" type="number" placeholder="Amount (OCTRA)" value={amount} onChange={e => setAmount(e.target.value)} />
              <p className="text-xs text-gray-500">The recipient's address will be derived using ECDH — not traceable on-chain.</p>
              <button className="btn-primary mt-auto" onClick={handleStealthSend} disabled={loading || !to || !amount}>
                {loading ? 'Sending…' : 'Stealth Send'}
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'scan' && (
        <div className="flex flex-col gap-3 flex-1">
          <button className="btn-secondary" onClick={handleScan} disabled={loading}>
            {loading ? 'Scanning…' : '🔍 Scan for Stealth Payments'}
          </button>
          <div className="flex-1 overflow-y-auto scrollbar-hide space-y-2">
            {claims.length === 0 && !loading && (
              <p className="text-gray-500 text-sm text-center mt-8">No stealth payments found</p>
            )}
            {claims.map((c, i) => (
              <div key={i} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.amount} OCTRA</p>
                  <p className="text-xs text-gray-500 font-mono">{c.txHash?.slice(0, 16)}…</p>
                </div>
                <button onClick={() => handleClaim(c)} className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs px-3 py-1.5 rounded-lg">Claim</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
