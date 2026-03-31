import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadWallet, getDefaultAddress } from '../wallet-store.js';
import { encryptBalance, decryptBalance, fromRaw } from '../tx.js';
import { getEncryptedBalance, getEncryptedCipher, getAccount, setRpcUrl } from '../rpc.js';
import { signTx } from '../crypto.js';

async function promptSecret(q) {
  process.stdout.write(q);
  const rl = createInterface({ input, output: process.stdout, terminal: false });
  const a  = await new Promise(res => rl.once('line', res));
  rl.close();
  process.stdout.write('\n');
  return a.trim();
}

export function registerFheCommands(program) {

  const fhe = program
    .command('fhe')
    .description('FHE (Fully Homomorphic Encryption) operations');

  // ── fhe encrypt ─────────────────────────────────────────────────────────────
  fhe
    .command('encrypt <amount>')
    .description('Move public balance → encrypted (FHE) balance')
    .option('-f, --from <address>', 'Wallet address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (amount, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = opts.from || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const pin  = await promptSecret(chalk.yellow('PIN: '));
      const spin = ora(`Encrypting ${amount} OCTRA…`).start();
      try {
        const wallet = loadWallet(addr, pin);
        // Check public balance first
        const acc = await getAccount(wallet.address);
        const bal = Number(acc?.balance_raw ?? 0) / 1e6;
        if (bal < parseFloat(amount)) {
          spin.fail(chalk.red(`Insufficient balance: ${bal.toFixed(6)} OCTRA available`));
          process.exit(1);
        }
        const hash = await encryptBalance(wallet, parseFloat(amount));
        spin.succeed(chalk.green('Encrypt transaction submitted!'));
        console.log(`${chalk.bold('Hash:')}    ${chalk.cyan(hash)}`);
        console.log(chalk.gray('The node will process the FHE proof. Check balance in ~30s.'));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── fhe decrypt ─────────────────────────────────────────────────────────────
  fhe
    .command('decrypt <amount>')
    .description('Move encrypted (FHE) balance → public balance')
    .option('-f, --from <address>', 'Wallet address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (amount, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = opts.from || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const pin  = await promptSecret(chalk.yellow('PIN: '));
      const spin = ora(`Decrypting ${amount} OCTRA…`).start();
      try {
        const wallet = loadWallet(addr, pin);
        const hash = await decryptBalance(wallet, parseFloat(amount));
        spin.succeed(chalk.green('Decrypt transaction submitted!'));
        console.log(`${chalk.bold('Hash:')}    ${chalk.cyan(hash)}`);
        console.log(chalk.gray('The node will process the FHE proof. Check balance in ~30s.'));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── fhe balance ─────────────────────────────────────────────────────────────
  fhe
    .command('balance [address]')
    .description('Show public + encrypted balance')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const spin = ora('Fetching balances…').start();
      try {
        const acc = await getAccount(addr);
        spin.succeed();
        const pubBal = Number(acc?.balance_raw ?? 0) / 1e6;
        console.log(`\n${chalk.bold('Address:')}          ${chalk.cyan(addr)}`);
        console.log(`${chalk.bold('Public balance:')}   ${chalk.green(pubBal.toFixed(6))} OCTRA`);
        console.log(`${chalk.bold('Has public key:')}   ${acc?.has_public_key ? chalk.green('yes') : chalk.red('no')}`);
        console.log(`${chalk.bold('Has enc balance:')}  ${acc?.has_encrypted_balance ? chalk.magenta('yes') : chalk.gray('no')}`);
        if (acc?.has_encrypted_balance) {
          console.log(chalk.gray('  (decrypt with: node bin/octra.js fhe decrypt <amount>)'));
        }
        console.log('');
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── fhe cipher ─────────────────────────────────────────────────────────────
  fhe
    .command('cipher [address]')
    .description('Get raw FHE ciphertext for an address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const spin = ora('Fetching cipher…').start();
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
