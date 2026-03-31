#!/usr/bin/env node
// Octra CLI — entry point
import { program } from 'commander';
import { registerWalletCommands } from '../src/commands/wallet.js';
import { registerTxCommands } from '../src/commands/tx.js';
import { registerFheCommands } from '../src/commands/fhe.js';
import { registerStealthCommands } from '../src/commands/stealth.js';
import { registerRpcCommands } from '../src/commands/rpc_cmd.js';
import chalk from 'chalk';

program
  .name('octra')
  .description(chalk.cyan('Octra Blockchain CLI — Privacy-First Wallet with FHE & Stealth'))
  .version('1.0.0');

registerWalletCommands(program);
registerTxCommands(program);
registerFheCommands(program);
registerStealthCommands(program);
registerRpcCommands(program);

program.parse();
