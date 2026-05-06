import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ScoreEngine } from '@correspond-os/core';
import { Normalizer } from '@correspond-os/core';
import { Deduplicator } from '@correspond-os/core';
import type { NormalizedMessage, ScoredItem } from '@correspond-os/shared';
import { BUCKET_THRESHOLDS } from '@correspond-os/shared';

export const triageCommand = new Command('triage')
  .description('Run the correspondence triage workflow')
  .option('--dry-run', 'Ingest and score only, do not draft responses')
  .option('--channel <name>', 'Ingest from a specific channel only')
  .option('--refresh', 'Skip already-responded items')
  .action(async (options) => {
    console.log(chalk.bold('\n📬 CorrespondOS — Triage\n'));

    const spinner = ora('Phase A: Ingesting messages...').start();

    try {
      // Phase A: Ingest
      // In a real implementation, this would call registered adapters
      // For now, demonstrate the pipeline with mock data
      const rawMessages = await ingestMessages(options.channel);
      spinner.succeed(`Phase A: Ingested ${rawMessages.length} messages`);

      // Phase B: Normalize & Deduplicate
      spinner.start('Phase B: Normalizing & deduplicating...');
      const normalizer = new Normalizer();
      const { messages, errors } = normalizer.normalizeBatch(rawMessages);
      
      const dedup = new Deduplicator();
      const deduplicated = dedup.deduplicate(messages);
      spinner.succeed(
        `Phase B: ${rawMessages.length} → ${deduplicated.length} unique items` +
          (errors.length > 0 ? chalk.yellow(` (${errors.length} parse errors)`) : ''),
      );

      // Phase C: Score & Prioritize
      spinner.start('Phase C: Scoring priorities...');
      const engine = new ScoreEngine();
      const scored = engine.scoreAll(deduplicated);
      
      const today = scored.filter((s) => s.bucket === 'today');
      const tomorrow = scored.filter((s) => s.bucket === 'tomorrow');
      const thisWeek = scored.filter((s) => s.bucket === 'this-week');
      spinner.succeed(
        `Phase C: Today(${today.length}) Tomorrow(${tomorrow.length}) This Week(${thisWeek.length})`,
      );

      // Display results
      console.log(chalk.bold('\n─── Priority Queue ───────────────────────────\n'));
      
      if (today.length > 0) {
        console.log(chalk.red.bold(`  🔴 Today (${today.length})`));
        displayItems(today);
      }

      if (tomorrow.length > 0) {
        console.log(chalk.yellow.bold(`\n  🟡 Tomorrow (${tomorrow.length})`));
        displayItems(tomorrow);
      }

      if (thisWeek.length > 0) {
        console.log(chalk.blue.bold(`\n  🔵 This Week (${thisWeek.length})`));
        displayItems(thisWeek);
      }

      console.log(chalk.dim('\n──────────────────────────────────────────────\n'));

      if (options.dryRun) {
        console.log(chalk.dim('  --dry-run: Skipping draft generation.\n'));
        return;
      }

      // Phase D-F would follow here
      console.log(chalk.green('  ✅ Triage complete. Run with --dry-run=false to draft responses.\n'));
    } catch (err) {
      spinner.fail('Triage failed');
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

function displayItems(items: ScoredItem[]): void {
  for (const item of items.slice(0, 10)) {
    const score = chalk.dim(`[${item.score.toFixed(2)}]`);
    const channel = chalk.cyan(`${item.channel}`);
    const contact = chalk.white(item.contactName);
    const subject = chalk.dim(item.subject.slice(0, 50));
    console.log(`    ${score} ${channel} ${contact} — ${subject}`);
  }
}

/** Mock ingest — in production, this calls registered adapters */
async function ingestMessages(_channel?: string): Promise<Array<Partial<NormalizedMessage> & { source: string; subject: string }>> {
  // Return sample data for demo purposes
  return [
    {
      source: 'outlook',
      contactName: 'Robert McDonnell',
      contactEmail: 'robert@anubatechnologies.com',
      subject: 'Council of Domain Experts Review',
      timestamp: new Date(),
      urgencySignals: ['high-importance'],
      relationshipTier: 'internal',
    },
    {
      source: 'gmail',
      contactName: 'Leon Davoyan',
      contactEmail: 'leon@dhc.com',
      subject: 'Re: Partnership Proposal',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      hubspotDealId: 'deal-dhc-001',
      metadata: { dealStage: 'negotiation' },
      urgencySignals: ['stale-deal'],
      relationshipTier: 'opportunity',
    },
    {
      source: 'linkedin',
      contactName: 'Sarah Chen',
      subject: 'Interested in Anuba platform',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      urgencySignals: ['unread-dm'],
      relationshipTier: 'lead',
    },
    {
      source: 'github',
      contactName: 'GitHub Actions',
      contactEmail: 'noreply@github.com',
      subject: 'anuba-crm Integration Tests FAILED',
      timestamp: new Date(),
      urgencySignals: ['ci-failure'],
      relationshipTier: 'unknown',
    },
    {
      source: 'confluence',
      contactName: 'Mithun Konduri',
      contactEmail: 'mithun@anubatechnologies.com',
      subject: 'Mentioned you in Sprint Planning',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      relationshipTier: 'internal',
    },
  ];
}
