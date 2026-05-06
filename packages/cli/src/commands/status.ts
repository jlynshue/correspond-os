import { Command } from 'commander';
import chalk from 'chalk';
import { APP } from '@correspond-os/shared';

export const statusCommand = new Command('status')
  .description('Show CorrespondOS status and connected adapters')
  .action(async () => {
    console.log(chalk.bold(`\n${APP.displayName} v${APP.version}\n`));
    console.log(chalk.dim('  Status: ') + chalk.green('Running'));
    console.log(chalk.dim('  Config: ') + chalk.white('~/.correspond-os/config.json'));
    console.log(chalk.dim('  DB:     ') + chalk.white('~/.correspond-os/data.db'));
    console.log();
    console.log(chalk.bold('  Adapters:'));
    console.log(chalk.dim('    gmail       ') + chalk.yellow('○ Not configured'));
    console.log(chalk.dim('    outlook     ') + chalk.yellow('○ Not configured'));
    console.log(chalk.dim('    hubspot     ') + chalk.yellow('○ Not configured'));
    console.log(chalk.dim('    linkedin    ') + chalk.yellow('○ Not configured'));
    console.log(chalk.dim('    slack       ') + chalk.yellow('○ Not configured'));
    console.log(chalk.dim('    confluence  ') + chalk.yellow('○ Not configured'));
    console.log();
    console.log(chalk.dim('  Run `correspond init` to configure adapters.\n'));
  });
