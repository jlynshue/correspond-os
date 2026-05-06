#!/usr/bin/env bun
import { Command } from 'commander';
import { APP } from '@correspond-os/shared';
import { triageCommand } from './commands/triage.js';
import { statusCommand } from './commands/status.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name(APP.name)
  .description(APP.description)
  .version(APP.version);

program.addCommand(triageCommand);
program.addCommand(statusCommand);
program.addCommand(initCommand);

program.parse();
