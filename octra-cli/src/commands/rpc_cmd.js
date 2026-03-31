import chalk from 'chalk';
import ora from 'ora';
import * as rpc from '../rpc.js';
import { setRpcUrl, getRpcUrl } from '../rpc.js';

export function registerRpcCommands(program) {

  const rpcCmd = program
    .command('rpc')
    .description('Raw RPC utilities');

  // ── rpc status ───────────────────────────────────────────────────────────────
  rpcCmd
    .command('status')
    .description('Check RPC node status')
    .option('--url <url>', 'RPC endpoint', 'http://46.101.86.250:8080')
    .action(async (opts) => {
      setRpcUrl(opts.url);
      const spin = ora(`Pinging ${opts.url}...`).start();
      try {
        const result = await rpc.stagingView();
        spin.succeed(chalk.green(`Node is UP — ${opts.url}`));
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        spin.fail(chalk.red(`Node unreachable: ${e.message}`));
        process.exit(1);
      }
    });

  // ── rpc call ─────────────────────────────────────────────────────────────────
  rpcCmd
    .command('call <method> [params...]')
    .description('Raw RPC call: octra rpc call octra_balance oct1...')
    .option('--url <url>', 'RPC endpoint')
    .action(async (method, params, opts) => {
      if (opts.url) setRpcUrl(opts.url);
      const spin = ora(`Calling ${method}...`).start();
      try {
        // Auto-parse JSON params
        const parsed = params.map(p => { try { return JSON.parse(p); } catch { return p; } });
        // Use internal call via dynamic import trick
        const res = await fetch(`${getRpcUrl()}/rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method, params: parsed, id: 1 }),
        });
        const data = await res.json();
        spin.succeed();
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });

  // ── rpc contracts ────────────────────────────────────────────────────────────
  rpcCmd
    .command('contracts')
    .description('List deployed smart contracts')
    .option('--url <url>', 'RPC endpoint')
    .action(async (opts) => {
      if (opts.url) setRpcUrl(opts.url);
      const spin = ora('Fetching contracts...').start();
      try {
        const result = await rpc.listContracts();
        spin.succeed();
        console.log(JSON.stringify(result, null, 2));
      } catch (e) {
        spin.fail(chalk.red(e.message));
        process.exit(1);
      }
    });
}
