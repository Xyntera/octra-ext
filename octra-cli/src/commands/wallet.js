import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  createNewWallet,
  importFromMnemonic,
  createWalletFromMnemonic,
  validateMnemonicPhrase,
} from '../crypto.js';
import { saveWallet, listWallets, loadWallet, getDefaultAddress } from '../wallet-store.js';
import { getBalance, getAccount } from '../rpc.js';
import { setRpcUrl } from '../rpc.js';

async function prompt(question) {
  const rl = createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function promptSecret(question) {
  // Note: Node readline doesn't hide input natively on all platforms
  // For production use a proper secret prompt library
  process.stdout.write(question);
  const rl = createInterface({ input, output: process.stdout, terminal: false });
  const answer = await new Promise(res => rl.once('line', res));
  rl.close();
  process.stdout.write('\n');
  return answer.trim();
}

export function registerWalletCommands(program) {

  const wallet = program
    .command('wallet')
    .description('Wallet management');

  // ── wallet create ───────────────────────────────────────────────────────────
  wallet
    .command('create')
    .description('Create a new wallet (generates 12-word mnemonic)')
    .option('-n, --name <name>', 'Wallet nickname')
    .option('--rpc <url>', 'RPC endpoint', 'http://46.101.86.250:8080')
    .action(async (opts) => {
      const pin  = await promptSecret(chalk.yellow('Set PIN: '));
      const pin2 = await promptSecret(chalk.yellow('Confirm PIN: '));
      if (pin !== pin2) { console.error(chalk.red('PINs do not match')); process.exit(1); }
      if (pin.length < 4) { console.error(chalk.red('PIN must be ≥ 4 characters')); process.exit(1); }

      const spin = ora('Generating wallet...').start();
      const w = createNewWallet();
      w.rpcUrl = opts.rpc;
      w.name   = opts.name || '';
      const path = saveWallet(w, pin);
      spin.succeed(chalk.green('Wallet created!'));

      console.log('');
      console.log(chalk.bold('⚠️  WRITE DOWN YOUR RECOVERY PHRASE — never share it!'));
      console.log(chalk.cyan('─'.repeat(60)));
      const words = w.mnemonic.split(' ');
      words.forEach((word, i) => {
        process.stdout.write(`${chalk.gray((i+1).toString().padStart(2,'0'))}. ${chalk.white(word.padEnd(12))}`);
        if ((i + 1) % 4 === 0) process.stdout.write('\n');
      });
      console.log(chalk.cyan('─'.repeat(60)));
      console.log(`${chalk.bold('Address:')} ${chalk.green(w.address)}`);
      console.log(`${chalk.bold('Saved:')}   ${chalk.gray(path)}`);
    });

  // ── wallet import ───────────────────────────────────────────────────────────
  wallet
    .command('import')
    .description('Import wallet from mnemonic phrase or private key (base64)')
    .option('--hd-version <n>', 'HD version (1 or 2)', '1')
    .option('--rpc <url>', 'RPC endpoint', 'http://46.101.86.250:8080')
    .action(async (opts) => {
      const phrase = await prompt(chalk.yellow('Enter mnemonic (12/24 words) or private key (base64): '));
      const pin    = await promptSecret(chalk.yellow('Set PIN: '));
      const pin2   = await promptSecret(chalk.yellow('Confirm PIN: '));
      if (pin !== pin2) { console.error(chalk.red('PINs do not match')); process.exit(1); }

      const spin = ora('Importing...').start();
      let w;
      if (phrase.split(' ').length >= 12) {
        w = importFromMnemonic(phrase, 0, parseInt(opts.hdVersion));
      } else {
        // raw private key b64
        const { createWalletFromPrivKey } = await import('../crypto.js');
        w = createWalletFromPrivKey(phrase);
      }
      w.rpcUrl = opts.rpc;
      const path = saveWallet(w, pin);
      spin.succeed(chalk.green('Wallet imported!'));
      console.log(`${chalk.bold('Address:')} ${chalk.green(w.address)}`);
      console.log(`${chalk.bold('Saved:')}   ${chalk.gray(path)}`);
    });

  // ── wallet list ─────────────────────────────────────────────────────────────
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
      console.log(chalk.gray('─'.repeat(70)));
      wallets.forEach((w, i) => {
        console.log(`${String(i+1).padEnd(4)} ${(w.name||'—').padEnd(20)} ${chalk.cyan(w.address)}`);
      });
      console.log('');
    });

  // ── wallet balance ──────────────────────────────────────────────────────────
  wallet
    .command('balance [address]')
    .description('Get wallet balance')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet found')); process.exit(1); }
      const spin = ora('Fetching balance...').start();
      try {
        const balance = await getBalance(addr);
        const account = await getAccount(addr);
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

  // ── wallet info ─────────────────────────────────────────────────────────────
  wallet
    .command('info [address]')
    .description('Show full account info from RPC')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet found')); process.exit(1); }
      const spin = ora('Fetching account info...').start();
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
