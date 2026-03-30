import React, { useState } from 'react';
import type { Screen } from '../App';

export default function ImportWallet({ nav }: { nav: (s: Screen) => void }) {
  const [phrase, setPhrase] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = () => {
    if (!phrase.trim()) { setError('Enter mnemonic or private key'); return; }
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (pin !== pin2) { setError('PINs do not match'); return; }
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'IMPORT_WALLET', phrase: phrase.trim(), pin }, (r) => {
      setLoading(false);
      if (r?.success) nav('dashboard');
      else setError(r?.error || 'Import failed');
    });
  };

  return (
    <div className="flex flex-col h-[580px] bg-gray-950 p-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('create')} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-lg font-bold">Import Wallet</h1>
      </div>
      <div className="flex flex-col gap-4 flex-1">
        <textarea
          className="input-field resize-none h-28"
          placeholder="Enter 12/24-word mnemonic phrase or private key (hex)"
          value={phrase}
          onChange={e => setPhrase(e.target.value)}
        />
        <input className="input-field" type="password" placeholder="Set PIN (min 4 digits)" value={pin} onChange={e => setPin(e.target.value)} />
        <input className="input-field" type="password" placeholder="Confirm PIN" value={pin2} onChange={e => setPin2(e.target.value)} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn-primary mt-auto" onClick={handleImport} disabled={loading}>
          {loading ? 'Importing…' : 'Import Wallet'}
        </button>
      </div>
    </div>
  );
}
