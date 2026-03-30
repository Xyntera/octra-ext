import React, { useEffect, useState } from 'react';
import Unlock from './screens/Unlock';
import Dashboard from './screens/Dashboard';
import Send from './screens/Send';
import Encrypt from './screens/Encrypt';
import Decrypt from './screens/Decrypt';
import History from './screens/History';
import Settings from './screens/Settings';
import Stealth from './screens/Stealth';
import CreateWallet from './screens/CreateWallet';
import ImportWallet from './screens/ImportWallet';

export type Screen = 'unlock' | 'create' | 'import' | 'dashboard' | 'send' | 'encrypt' | 'decrypt' | 'history' | 'settings' | 'stealth';

export default function App() {
  const [screen, setScreen] = useState<Screen>('unlock');
  const [walletExists, setWalletExists] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['wallet_encrypted'], (r) => {
      if (r.wallet_encrypted) {
        setWalletExists(true);
        setScreen('unlock');
      } else {
        setWalletExists(false);
        setScreen('create');
      }
    });
  }, []);

  if (walletExists === null) {
    return (
      <div className="flex items-center justify-center h-[580px] bg-gray-950">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nav = (s: Screen) => setScreen(s);

  switch (screen) {
    case 'unlock':    return <Unlock nav={nav} />;
    case 'create':    return <CreateWallet nav={nav} />;
    case 'import':    return <ImportWallet nav={nav} />;
    case 'dashboard': return <Dashboard nav={nav} />;
    case 'send':      return <Send nav={nav} />;
    case 'encrypt':   return <Encrypt nav={nav} />;
    case 'decrypt':   return <Decrypt nav={nav} />;
    case 'history':   return <History nav={nav} />;
    case 'settings':  return <Settings nav={nav} />;
    case 'stealth':   return <Stealth nav={nav} />;
    default:          return <Dashboard nav={nav} />;
  }
}
