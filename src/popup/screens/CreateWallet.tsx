import React, { useEffect, useState } from 'react';
import type { Screen } from '../App';

export default function CreateWallet({ nav }: { nav: (s: Screen) => void }) {
  const [mnemonic, setMnemonic] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [step, setStep] = useState<'generate' | 'confirm' | 'pin'>('generate');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GENERATE_MNEMONIC' }, (r) => {
      if (r?.mnemonic) setMnemonic(r.mnemonic);
    });
  }, []);

  const handleCreate = () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (pin !== pin2) { setError('PINs do not match'); return; }
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'CREATE_WALLET', mnemonic, pin }, (r) => {
      setLoading(false);
      if (r?.success) nav('dashboard');
      else setError(r?.error || 'Failed to create wallet');
    });
  };

  return (
    <div className="flex flex-col h-[580px] bg-gray-950 p-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">O</div>
        <h1 className="text-lg font-bold">Create Wallet</h1>
      </div>

      {step === 'generate' && (
        <div className="flex flex-col gap-4 flex-1">
          <p className="text-gray-400 text-sm">Write down your 12-word recovery phrase and keep it safe. Never share it.</p>
          <div className="grid grid-cols-3 gap-2">
            {mnemonic.split(' ').map((w, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center">
                <span className="text-gray-500 mr-1">{i + 1}.</span>{w}
              </div>
            ))}
          </div>
          <button className="btn-primary mt-auto" onClick={() => setStep('pin')}>I've saved my phrase →</button>
          <button className="btn-secondary" onClick={() => nav('import')}>Import existing wallet</button>
        </div>
      )}

      {step === 'pin' && (
        <div className="flex flex-col gap-4 flex-1">
          <p className="text-gray-400 text-sm">Set a PIN to protect your wallet.</p>
          <input className="input-field" type="password" placeholder="Enter PIN (min 4 digits)" value={pin} onChange={e => setPin(e.target.value)} />
          <input className="input-field" type="password" placeholder="Confirm PIN" value={pin2} onChange={e => setPin2(e.target.value)} />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary mt-auto" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating…' : 'Create Wallet'}
          </button>
        </div>
      )}
    </div>
  );
}
