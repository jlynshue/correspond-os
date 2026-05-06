import { Command } from 'commander';
import chalk from 'chalk';
import { APP } from '@correspond-os/shared';

export const initCommand = new Command('init')
  .description('Initialize CorrespondOS configuration')
  .action(async () => {
    console.log(chalk.bold(`\n🚀 ${APP.displayName} Setup\n`));
    console.log(chalk.dim('  This will create a configuration file at:'));
    console.log(chalk.white('  ~/.correspond-os/config.json\n'));
    console.log(chalk.yellow('  ⚠️  Interactive setup not yet implemented.'));
    console.log(chalk.dim('  For now, create the config file manually.\n'));
    console.log(chalk.dim('  Example config:'));
    console.log(chalk.cyan(JSON.stringify({
      adapters: {
        gmail: {
          enabled: true,
          accounts: ['you@gmail.com'],
          mcpServer: 'google-workspace',
        },
        outlook: {
          enabled: true,
          mcpServer: 'lokka-microsoft-anuba',
        },
      },
      scoring: {
        weights: { revenueImpact: 0.4, timeSensitivity: 0.3, relationshipTier: 0.2, channelUrgency: 0.1 },
      },
    }, null, 2)));
    console.log();
  });
