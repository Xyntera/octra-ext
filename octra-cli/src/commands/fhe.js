import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadWallet, getDefaultAddress } from '../wallet-store.js';
import { encryptBalance, decryptBalance } from '../tx.js';
import { getEncryptedBalance, getEncryptedCipher } from '../rpc.js';
import { setRpcUrl } from '../rpc.js';

async function promptSecret(q) {
  process.stdout.write(q);
  const rl = createInterface({ input, output: process.stdout, terminal: false });
  const a = await new Promise(res => rl.once('line', res));
  rl.close();
  process.stdout.write('\n');
  return a.trim();
}

export function registerFheCommands(program) {

  const fhe = program
    .command('fhe')
    .description('FHE (Fully Homomorphic Encryption) operations');

  // ── fhe encrypt ──────────────────────────────────────────────────────────────
  fhe
    .command('encrypt <amount>')
    .description('Move public balance to encrypted (FHE) balance')
    .option('-f, --from <address>', 'Wallet address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (amount, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = opts.from || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const pin  = await promptSecret(chalk.yellow('PIN: '));
      const spin = ora(`Encrypting ${amount} OCTRA (FHE proof may take ~10s)...`).start();
      try {
        const wallet = loadWallet(addr, pin);
        const result = await encryptBalance(wallet, parseFloat(amount));
        spin.succeed(chalk.green('Balance encrypted!'));
        console.log(`${chalk.bold('Hash:')} ${chalk.cyan(result)}`);
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── fhe decrypt ──────────────────────────────────────────────────────────────
  fhe
    .command('decrypt <amount>')
    .description('Move encrypted (FHE) balance back to public balance')
    .option('-f, --from <address>', 'Wallet address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (amount, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = opts.from || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const pin  = await promptSecret(chalk.yellow('PIN: '));
      const spin = ora(`Decrypting ${amount} OCTRA (range proof may take ~10s)...`).start();
      try {
        const wallet = loadWallet(addr, pin);
        const result = await decryptBalance(wallet, parseFloat(amount));
        spin.succeed(chalk.green('Balance decrypted!'));
        console.log(`${chalk.bold('Hash:')} ${chalk.cyan(result)}`);
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── fhe balance ──────────────────────────────────────────────────────────────
  fhe
    .command('balance [address]')
    .description('Show encrypted balance')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const pin = await promptSecret(chalk.yellow('PIN (needed to sign balance request): '));
      const spin = ora('Fetching encrypted balance...').start();
      try {
        const wallet = loadWallet(addr, pin);
        const { signTx } = await import('../crypto.js');
        const sig = await signTx({ addr, action: 'encrypted_balance' }, wallet.privKeyB64);
        const result = await getEncryptedBalance(addr, sig, wallet.pubKeyB64);
        spin.succeed();
        console.log(`${chalk.bold('Encrypted balance:')} ${chalk.magenta(JSON.stringify(result))}`);
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── fhe cipher ───────────────────────────────────────────────────────────────
  fhe
    .command('cipher [address]')
    .description('Get raw FHE ciphertext for an address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const spin = ora('Fetching cipher...').start();
      try {
        const result = await getEncryptedCipher(addr);
        spin.succeed();
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });
}
