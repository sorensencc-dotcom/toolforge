#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import installCmd from './commands/install.js';
import listCmd from './commands/list.js';
import searchCmd from './commands/search.js';

yargs(hideBin(process.argv))
  .command(installCmd)
  .command(listCmd)
  .command(searchCmd)
  .option('api-url', {
    describe: 'Marketplace API URL',
    default: 'http://localhost:3000',
    global: true,
  })
  .option('verbose', {
    describe: 'Enable verbose output',
    boolean: true,
    alias: 'v',
    global: true,
  })
  .demandCommand()
  .help()
  .alias('h', 'help')
  .parse();
