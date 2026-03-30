import React, { useState } from 'react';
import type { Screen } from '../App';

export default function Unlock({ nav }: { nav: (s: Screen) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = () => {
    if (!pin) return;
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'UNLOCK', pin }, (r) => {
      setLoading(false);
      if (r?.success) nav('dashboard');
      else setError('Wrong PIN');
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-[580px] bg-gray-950 p-6 gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-3xl font-bold">O</div>
        <h1 className="text-2xl font-bold">Octra Wallet</h1>
        <p className="text-gray-400 text-sm">Enter PIN to unlock</p>
      </div>
      <div className="w-full flex flex-col gap-3">
        <input
          className="input-field text-center text-2xl tracking-widest"
          type="password"
          placeholder="••••••"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          autoFocus
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button className="btn-primary" onClick={handleUnlock} disabled={loading}>
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
        <button className="text-gray-500 text-xs hover:text-gray-300 text-center" onClick={() => nav('import')}>
          Restore with recovery phrase
        </button>
      </div>
    </div>
  );
}
