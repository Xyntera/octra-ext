import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as ed from '@noble/ed25519';
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils';
import { sha512 } from '@noble/hashes/sha512';
import {
  createNewWallet,
  importFromMnemonic,
  createWalletFromPrivKey,
} from '../crypto.js';
import { saveWallet, listWallets, loadWallet, getDefaultAddress } from '../wallet-store.js';
import { getBalance, getAccount, getViewPubkey, registerPublicKey, setRpcUrl } from '../rpc.js';

// noble-ed25519 needs sha512 sync shim
import { sha256 } from '@noble/hashes/sha256';
ed.etc.sha512Sync = (...msgs) => sha512(concatBytes(...msgs));

async function prompt(question) {
  const rl = createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function promptSecret(question) {
  process.stdout.write(question);
  const rl = createInterface({ input, output: process.stdout, terminal: false });
  const answer = await new Promise(res => rl.once('line', res));
  rl.close();
  process.stdout.write('\n');
  return answer.trim();
}

/**
 * Mirrors: ensure_pubkey_registered() in main.cpp
 * msg = "register_pubkey:" + addr  →  sign with Ed25519 sk  →  base64 sig
 */
async function ensurePubkeyRegistered(wallet, spin) {
  try {
    setRpcUrl(wallet.rpcUrl || 'http://46.101.86.250:8080');
    const remote = await getViewPubkey(wallet.address);
    if (remote?.view_pubkey) return; // already registered

    spin.text = 'Registering public key on-chain…';
    const msg     = utf8ToBytes(`register_pubkey:${wallet.address}`);
    const privKey = new Uint8Array(Buffer.from(wallet.privKeyB64, 'base64'));
    const sig     = Buffer.from(ed.sign(msg, privKey)).toString('base64');
    await registerPublicKey(wallet.address, wallet.pubKeyB64, sig);
    spin.text = 'Public key registered ✔';
  } catch (e) {
    // non-fatal — warn only
    spin.text = chalk.yellow(`⚠ pubkey register skipped: ${e.message}`);
  }
}

export function registerWalletCommands(program) {

  const wallet = program
    .command('wallet')
    .description('Wallet management');

  // ── wallet create ─────────────────────────────────────────────────────────
  wallet
    .command('create')
    .description('Create a new wallet (generates 12-word mnemonic)')
    .option('-n, --name <name>', 'Wallet nickname')
    .option('--rpc <url>', 'RPC endpoint', 'http://46.101.86.250:8080')
    .action(async (opts) => {
      const pin  = await promptSecret(chalk.yellow('Set PIN: '));
      const pin2 = await promptSecret(chalk.yellow('Confirm PIN: '));
      if (pin !== pin2)   { console.error(chalk.red('PINs do not match')); process.exit(1); }
      if (pin.length < 4) { console.error(chalk.red('PIN must be ≥ 4 characters')); process.exit(1); }

      const spin = ora('Generating wallet…').start();
      try {
        const w  = createNewWallet();
        w.rpcUrl = opts.rpc;
        w.name   = opts.name || '';
        const path = saveWallet(w, pin);
        spin.text = 'Registering public key…';
        await ensurePubkeyRegistered(w, spin);
        spin.succeed(chalk.green('Wallet created!'));

        console.log('');
        console.log(chalk.bold('⚠️  WRITE DOWN YOUR RECOVERY PHRASE — never share it!'));
        console.log(chalk.cyan('─'.repeat(56)));
        const words = w.mnemonic.split(' ');
        words.forEach((word, i) => {
          process.stdout.write(
            `${chalk.gray(String(i+1).padStart(2,'0'))}. ${chalk.white(word.padEnd(12))}`
          );
          if ((i + 1) % 4 === 0) process.stdout.write('\n');
        });
        console.log(chalk.cyan('─'.repeat(56)));
        console.log(`${chalk.bold('Address:')} ${chalk.green(w.address)}`);
        console.log(`${chalk.bold('Saved:')}   ${chalk.gray(path)}`);
        console.log('');
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── wallet import ─────────────────────────────────────────────────────────
  wallet
    .command('import')
    .description('Import wallet from mnemonic phrase or private key (base64)')
    .option('--hd-version <n>', 'HD version (1 or 2)', '1')
    .option('--rpc <url>', 'RPC endpoint', 'http://46.101.86.250:8080')
    .action(async (opts) => {
      const phrase = await prompt(chalk.yellow('Enter mnemonic (12/24 words) or private key (base64): '));
      const pin    = await promptSecret(chalk.yellow('Set PIN: '));
      const pin2   = await promptSecret(chalk.yellow('Confirm PIN: '));
      if (pin !== pin2)   { console.error(chalk.red('PINs do not match')); process.exit(1); }
      if (pin.length < 4) { console.error(chalk.red('PIN must be ≥ 4 characters')); process.exit(1); }

      const spin = ora('Importing…').start();
      try {
        let w;
        const wordCount = phrase.trim().split(/\s+/).length;
        if (wordCount >= 12) {
          w = importFromMnemonic(phrase.trim(), 0, parseInt(opts.hdVersion));
        } else {
          w = createWalletFromPrivKey(phrase.trim());
        }
        w.rpcUrl = opts.rpc;
        w.name   = '';
        const path = saveWallet(w, pin);
        spin.text = 'Registering public key on-chain…';
        await ensurePubkeyRegistered(w, spin);
        spin.succeed(chalk.green('Wallet imported!'));
        console.log(`${chalk.bold('Address:')} ${chalk.green(w.address)}`);
        console.log(`${chalk.bold('Saved:')}   ${chalk.gray(path)}`);
        console.log('');
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── wallet list ───────────────────────────────────────────────────────────
  wallet
    .command('list')
    .description('List all wallets')
    .action(() => {
      const wallets = listWallets();
      if (wallets.length === 0) {
        console.log(chalk.yellow('No wallets found. Run: octra wallet create'));
        return;
      }
      console.log(chalk.bold(`\n${'#'.padEnd(4)} ${'Name'.padEnd(20)} Address`));
      console.log(chalk.gray('─'.repeat(72)));
      wallets.forEach((w, i) => {
        console.log(`${String(i+1).padEnd(4)} ${(w.name||'—').padEnd(20)} ${chalk.cyan(w.address)}`);
      });
      console.log('');
    });

  // ── wallet select ─────────────────────────────────────────────────────────
  wallet
    .command('select')
    .description('Select default wallet from saved wallets')
    .action(async () => {
      const wallets = listWallets();
      if (wallets.length === 0) {
        console.log(chalk.yellow('No wallets found. Run: octra wallet create'));
        return;
      }
      if (wallets.length === 1) {
        console.log(chalk.cyan(`Only one wallet: ${wallets[0].address}`));
        console.log(chalk.gray('It is already the default.'));
        return;
      }

      console.log(chalk.bold('\nSelect a wallet:'));
      console.log(chalk.gray('─'.repeat(72)));
      wallets.forEach((w, i) => {
        console.log(
          `  ${chalk.bold(String(i+1))}. ${chalk.cyan(w.address)}` +
          (w.name ? chalk.gray(` (${w.name})`) : '')
        );
      });
      console.log('');

      const answer = await prompt(chalk.yellow(`Enter number (1-${wallets.length}): `));
      const idx    = parseInt(answer) - 1;
      if (isNaN(idx) || idx < 0 || idx >= wallets.length) {
        console.error(chalk.red('Invalid selection'));
        process.exit(1);
      }

      const chosen = wallets[idx];
      const { setDefaultAddress } = await import('../wallet-store.js');
      setDefaultAddress(chosen.address);
      console.log(chalk.green(`✔ Default wallet set to: ${chosen.address}`));
    });

  // ── wallet balance ────────────────────────────────────────────────────────
  wallet
    .command('balance [address]')
    .description('Get wallet balance')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet found. Run: octra wallet create')); process.exit(1); }
      const spin = ora('Fetching balance…').start();
      try {
        const [balance, account] = await Promise.all([
          getBalance(addr),
          getAccount(addr),
        ]);
        spin.succeed();
        console.log(`\n${chalk.bold('Address:')} ${chalk.cyan(addr)}`);
        console.log(`${chalk.bold('Balance:')} ${chalk.green(balance)} OCTRA`);
        console.log(`${chalk.bold('Nonce:')}   ${account?.nonce ?? 0}`);
        if (account?.encrypted_balance) {
          console.log(`${chalk.bold('Encrypted:')} ${chalk.magenta(account.encrypted_balance)} OCTRA`);
        }
        console.log('');
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── wallet info ───────────────────────────────────────────────────────────
  wallet
    .command('info [address]')
    .description('Show full account info from RPC')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet found')); process.exit(1); }
      const spin = ora('Fetching account info…').start();
      try {
        const account = await getAccount(addr, 5);
        spin.succeed();
        console.log(JSON.stringify(account, null, 2));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });
}
