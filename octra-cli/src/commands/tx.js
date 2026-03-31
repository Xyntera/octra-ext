import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync } from 'node:fs';
import { loadWallet, getDefaultAddress } from '../wallet-store.js';
import { sendTransfer, sendBatch } from '../tx.js';
import { getTransaction, getTxsByAddr, stagingView, setRpcUrl } from '../rpc.js';

async function promptSecret(q) {
  process.stdout.write(q);
  const rl = createInterface({ input, output: process.stdout, terminal: false });
  const a  = await new Promise(res => rl.once('line', res));
  rl.close();
  process.stdout.write('\n');
  return a.trim();
}

export function registerTxCommands(program) {

  // ── send ─────────────────────────────────────────────────────────────────────
  program
    .command('send <to> <amount>')
    .description('Send OCTRA to an address')
    .option('-f, --from <address>', 'Sender address (default: first wallet)')
    .option('-m, --memo <text>',    'Optional memo')
    .option('--rpc <url>',          'RPC endpoint')
    .action(async (to, amount, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = opts.from || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet. Run: octra wallet create')); process.exit(1); }
      const pin  = await promptSecret(chalk.yellow('PIN: '));
      const spin = ora(`Sending ${amount} OCTRA to ${to.slice(0,16)}…`).start();
      try {
        const wallet = loadWallet(addr, pin);
        const result = await sendTransfer(wallet, to, parseFloat(amount), opts.memo || '');
        spin.succeed(chalk.green('Transaction submitted!'));
        console.log(`${chalk.bold('Hash:')} ${chalk.cyan(result)}`);
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── batch ───────────────────────────────────────────────────────────────────
  program
    .command('batch <file>')
    .description('Batch send from JSON file [{to, amount, memo?}]')
    .option('-f, --from <address>', 'Sender address')
    .option('--rpc <url>',          'RPC endpoint')
    .action(async (file, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = opts.from || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      let recipients;
      try { recipients = JSON.parse(readFileSync(file, 'utf8')); }
      catch { console.error(chalk.red(`Cannot read file: ${file}`)); process.exit(1); }
      const pin  = await promptSecret(chalk.yellow('PIN: '));
      const spin = ora(`Sending ${recipients.length} transactions…`).start();
      try {
        const wallet  = loadWallet(addr, pin);
        const results = await sendBatch(wallet, recipients);
        spin.succeed(chalk.green(`${results.length} transactions sent!`));
        results.forEach((hash, i) => {
          console.log(`  ${chalk.gray(i+1)}. ${chalk.cyan(hash)}`);
        });
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── tx ────────────────────────────────────────────────────────────────────────
  program
    .command('tx <hash>')
    .description('Get transaction details by hash')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (hash, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const spin = ora('Fetching transaction…').start();
      try {
        const tx = await getTransaction(hash);
        spin.succeed();
        console.log(JSON.stringify(tx, null, 2));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── history ────────────────────────────────────────────────────────────────
  program
    .command('history [address]')
    .description('Show transaction history')
    .option('-l, --limit <n>', 'Number of txs', '20')
    .option('--rpc <url>',     'RPC endpoint')
    .action(async (address, opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const addr = address || getDefaultAddress();
      if (!addr) { console.error(chalk.red('No wallet')); process.exit(1); }
      const spin = ora('Fetching history…').start();
      try {
        const raw  = await getTxsByAddr(addr, parseInt(opts.limit));
        // RPC may return array directly, or { transactions: [] }, or { txs: [] }
        const txs  = Array.isArray(raw)
          ? raw
          : (raw?.transactions ?? raw?.txs ?? raw?.items ?? []);
        spin.succeed();
        if (txs.length === 0) {
          console.log(chalk.yellow('No transactions found'));
          return;
        }
        console.log(chalk.bold(`\n${'Type'.padEnd(10)} ${'Amount'.padEnd(16)} ${'Hash'}`));
        console.log(chalk.gray('─'.repeat(72)));
        for (const tx of txs) {
          const type   = (tx.type   || 'transfer').padEnd(10);
          const amount = String(tx.amount || '').padEnd(16);
          const hash   = (tx.hash   || tx.tx_hash || '').slice(0, 24);
          console.log(`${chalk.cyan(type)} ${chalk.green(amount)} ${chalk.gray(hash)}`);
        }
        console.log('');
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── staging ────────────────────────────────────────────────────────────────
  program
    .command('staging')
    .description('View mempool / staging area')
    .option('--rpc <url>', 'RPC endpoint')
    .action(async (opts) => {
      if (opts.rpc) setRpcUrl(opts.rpc);
      const spin = ora('Fetching staging…').start();
      try {
        const result = await stagingView();
        spin.succeed();
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });
}
