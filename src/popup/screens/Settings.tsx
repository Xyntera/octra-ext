import React, { useEffect, useState } from 'react';
import type { Screen } from '../App';

export default function Settings({ nav }: { nav: (s: Screen) => void }) {
  const [address, setAddress] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [pin, setPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_WALLET_INFO' }, (r) => {
      if (r?.address) setAddress(r.address);
    });
  }, []);

  const revealMnemonic = () => {
    if (!pin) return;
    chrome.runtime.sendMessage({ type: 'EXPORT_MNEMONIC', pin }, (r) => {
      if (r?.mnemonic) { setMnemonic(r.mnemonic); setShowMnemonic(true); }
      else alert('Wrong PIN');
    });
  };

  const handleLock = () => {
    chrome.runtime.sendMessage({ type: 'LOCK' }, () => nav('unlock'));
  };

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    chrome.storage.local.clear(() => nav('create'));
  };

  return (
    <div className="flex flex-col h-[580px] bg-gray-950 p-5 gap-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => nav('dashboard')} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      {/* Address */}
      <div className="card">
        <p className="text-xs text-gray-400 mb-1">Wallet Address</p>
        <p className="text-xs font-mono break-all text-gray-200">{address}</p>
      </div>

      {/* Export mnemonic */}
      <div className="card flex flex-col gap-2">
        <p className="text-sm font-medium">Export Recovery Phrase</p>
        {showMnemonic ? (
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {mnemonic.split(' ').map((w, i) => (
              <div key={i} className="bg-gray-800 rounded-lg px-2 py-1 text-xs text-center">
                <span className="text-gray-500">{i+1}.</span> {w}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <input className="input-field text-sm py-2" type="password" placeholder="Enter PIN" value={pin} onChange={e => setPin(e.target.value)} />
            <button onClick={revealMnemonic} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 rounded-xl whitespace-nowrap">Reveal</button>
          </div>
        )}
      </div>

      {/* Lock */}
      <button className="btn-secondary" onClick={handleLock}>🔒 Lock Wallet</button>

      {/* Reset */}
      <button
        className={`mt-auto py-2.5 rounded-xl font-semibold text-sm transition-colors ${confirmReset ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-900 border border-gray-700 text-red-400 hover:border-red-600'}`}
        onClick={handleReset}
      >
        {confirmReset ? '⚠️ Click again to confirm RESET' : 'Reset Wallet'}
      </button>
    </div>
  );
}
