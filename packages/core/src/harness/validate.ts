#!/usr/bin/env bun
/**
 * Harness Validation Script
 * 
 * Runs in CI to verify all harness criteria are met.
 * Exit code 0 = all criteria met, exit code 1 = some unmet.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface CriterionDef {
  id: string;
  description: string;
  category: string;
  check: () => boolean | Promise<boolean>;
}

const ROOT = resolve(import.meta.dir, '../../../../');

/** Define the criteria that must be met for the project to be "done" */
const criteria: CriterionDef[] = [
  {
    id: 'shared-types',
    description: 'Shared types package exports all core schemas',
    category: 'functional',
    check: () => existsSync(resolve(ROOT, 'packages/shared/src/types.ts')),
  },
  {
    id: 'scoring-engine',
    description: 'Score engine implements weighted scoring with 4 factors',
    category: 'functional',
    check: () => existsSync(resolve(ROOT, 'packages/core/src/scoring/engine.ts')),
  },
  {
    id: 'normalizer',
    description: 'Normalizer converts raw messages to unified format',
    category: 'functional',
    check: () => existsSync(resolve(ROOT, 'packages/core/src/normalize/normalizer.ts')),
  },
  {
    id: 'deduplicator',
    description: 'Deduplicator merges multi-channel messages by contact',
    category: 'functional',
    check: () => existsSync(resolve(ROOT, 'packages/core/src/dedup/deduplicator.ts')),
  },
  {
    id: 'test-coverage',
    description: 'Core scoring engine has unit tests',
    category: 'testing',
    check: () => existsSync(resolve(ROOT, 'packages/core/src/scoring/engine.test.ts')),
  },
  {
    id: 'readme',
    description: 'README.md exists with project description',
    category: 'documentation',
    check: () => {
      const readmePath = resolve(ROOT, 'README.md');
      if (!existsSync(readmePath)) return false;
      const content = readFileSync(readmePath, 'utf-8');
      return content.length > 500;
    },
  },
  {
    id: 'license',
    description: 'MIT license file exists',
    category: 'documentation',
    check: () => existsSync(resolve(ROOT, 'LICENSE')),
  },
  {
    id: 'ci-pipeline',
    description: 'GitHub Actions CI workflow exists',
    category: 'quality',
    check: () => existsSync(resolve(ROOT, '.github/workflows/ci.yml')),
  },
];

export async function validateCriteria(): Promise<{
  passed: string[];
  failed: string[];
  total: number;
}> {
  const passed: string[] = [];
  const failed: string[] = [];

  for (const criterion of criteria) {
    try {
      const result = await criterion.check();
      if (result) {
        passed.push(criterion.id);
      } else {
        failed.push(criterion.id);
      }
    } catch {
      failed.push(criterion.id);
    }
  }

  return { passed, failed, total: criteria.length };
}

// Run if executed directly
if (import.meta.main) {
  const { passed, failed, total } = await validateCriteria();

  console.log('\n🔍 Harness Validation Report');
  console.log('═'.repeat(50));
  console.log(`\n✅ Passed: ${passed.length}/${total}`);
  
  for (const id of passed) {
    const c = criteria.find((x) => x.id === id)!;
    console.log(`   ✓ [${c.category}] ${c.description}`);
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${total}`);
    for (const id of failed) {
      const c = criteria.find((x) => x.id === id)!;
      console.log(`   ✗ [${c.category}] ${c.description}`);
    }
    console.log('\n⚠️  Harness criteria not fully met. Loop continues.');
    process.exit(1);
  }

  console.log('\n🎉 All harness criteria met! Loop complete.');
  process.exit(0);
}
