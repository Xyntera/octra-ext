import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadWallet, getDefaultAddress } from '../wallet-store.js';
import { stealthSend } from '../tx.js';
import { getStealthOutputs, getViewPubkey } from '../rpc.js';
import { setRpcUrl } from '../rpc.js';

async function promptSecret(q) {
  process.stdout.write(q);
  const rl = createInterface({ input, output: process.stdout, terminal: false });
  const a = await new Promise(res => rl.once('line', res));
  rl.close();
  process.stdout.write('\n');
  return a.trim();
}

export function registerStealthCommands(program) {

  const stealth = program
    .command('stealth')
    .description('Stealth transaction operations');

  // ── stealth send ─────────────────────────────────────────────────────────────
  stealth
    .command('send <to> <amount>')
    .description('Send OCTRA via stealth transaction (ECDH-derived address)')
    .option('-f, --from <address>', 'Sender address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (to, amount, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = opts.from || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const pin  = await promptSecret(chalk.yellow('PIN: '));
      const spin = ora(`Stealth send ${amount} OCTRA to ${to.slice(0,12)}...`).start();
      try {
        const wallet = loadWallet(addr, pin);
        const result = await stealthSend(wallet, to, parseFloat(amount));
        spin.succeed(chalk.green('Stealth transaction sent!'));
        console.log(`${chalk.bold('Hash:')} ${chalk.cyan(result)}`);
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── stealth scan ─────────────────────────────────────────────────────────────
  stealth
    .command('scan')
    .description('Scan for incoming stealth payments')
    .option('--from-epoch <n>', 'Start epoch', '0')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const spin = ora('Scanning for stealth outputs...').start();
      try {
        const outputs = await getStealthOutputs(parseInt(opts.fromEpoch || 0));
        spin.succeed();
        if (!outputs || outputs.length === 0) {
          console.log(chalk.yellow('No stealth outputs found'));
          return;
        }
        console.log(chalk.bold(`\nFound ${outputs.length} stealth output(s):\n`));
        for (const o of outputs) {
          console.log(JSON.stringify(o, null, 2));
        }
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── stealth viewkey ──────────────────────────────────────────────────────────
  stealth
    .command('viewkey [address]')
    .description('Get public view key for an address')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const spin = ora('Fetching view key...').start();
      try {
        const result = await getViewPubkey(addr);
        spin.succeed();
        console.log(`${chalk.bold('View public key:')} ${chalk.cyan(JSON.stringify(result))}`);
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });
}
