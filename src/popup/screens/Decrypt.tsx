import React, { useState } from 'react';
import type { Screen } from '../App';

export default function Decrypt({ nav }: { nav: (s: Screen) => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  const handleDecrypt = () => {
    if (!amount) return;
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'DECRYPT_BALANCE', amount: parseFloat(amount) }, (r) => {
      setLoading(false);
      setResult(r);
    });
  };

  return (
    <div className="flex flex-col h-[580px] bg-gray-950 p-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('dashboard')} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-lg font-bold">Decrypt Balance</h1>
      </div>

      <div className="card mb-4">
        <p className="text-xs text-gray-400">🔓 FHE Decryption</p>
        <p className="text-sm mt-1">Move encrypted balance back to your public balance. Requires a range proof.</p>
      </div>

      {result ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          {result.success ? (
            <><div className="text-5xl">🔓</div><p className="font-semibold">Balance Decrypted!</p><p className="text-xs text-gray-400 font-mono break-all text-center">{result.txHash}</p></>
          ) : (
            <><div className="text-5xl">❌</div><p className="text-red-400">{result.error}</p></>
          )}
          <button className="btn-primary" onClick={() => { setResult(null); nav('dashboard'); }}>Back</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Amount to Decrypt (OCTRA)</label>
            <input className="input-field" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <p className="text-xs text-gray-500">⚠️ Generating range proof may take 5–15 seconds.</p>
          <button className="btn-primary mt-auto" onClick={handleDecrypt} disabled={loading || !amount}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating proof…
              </span>
            ) : `Decrypt ${amount || '0'} OCTRA`}
          </button>
        </div>
      )}
    </div>
  );
}
