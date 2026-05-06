import type { HarnessState, HarnessCriterion, HarnessEvidence, HarnessDecision } from '@correspond-os/shared';
import { generateId } from '@correspond-os/shared';

/**
 * HarnessRunner drives the continuous development loop.
 *
 * Loop: develop → test → validate → document → (repeat if criteria unmet)
 *
 * The harness ensures:
 * - All criteria are tracked and validated
 * - Evidence is collected at each iteration
 * - Decisions are documented with rationale
 * - The loop only terminates when ALL criteria are met
 */
export class HarnessRunner {
  private state: HarnessState;

  constructor(criteria: Omit<HarnessCriterion, 'met' | 'evidence' | 'verifiedAt'>[]) {
    this.state = {
      phase: 'setup',
      iteration: 0,
      criteria: criteria.map((c) => ({ ...c, met: false })),
      evidence: [],
      decisions: [],
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
    };
  }

  /** Get current harness state */
  getState(): Readonly<HarnessState> {
    return { ...this.state };
  }

  /** Check if all criteria are met */
  isComplete(): boolean {
    return this.state.criteria.every((c) => c.met);
  }

  /** Advance to next iteration */
  nextIteration(): number {
    this.state.iteration += 1;
    this.state.phase = 'develop';
    this.state.lastUpdatedAt = new Date();
    return this.state.iteration;
  }

  /** Mark a criterion as met with evidence */
  satisfy(criterionId: string, evidence: string): void {
    const criterion = this.state.criteria.find((c) => c.id === criterionId);
    if (!criterion) throw new Error(`Criterion not found: ${criterionId}`);

    criterion.met = true;
    criterion.evidence = evidence;
    criterion.verifiedAt = new Date();
    this.state.lastUpdatedAt = new Date();
  }

  /** Record evidence */
  addEvidence(evidence: Omit<HarnessEvidence, 'id' | 'createdAt' | 'iteration'>): void {
    this.state.evidence.push({
      ...evidence,
      id: generateId(),
      createdAt: new Date(),
      iteration: this.state.iteration,
    });
    this.state.lastUpdatedAt = new Date();
  }

  /** Record a decision */
  addDecision(decision: Omit<HarnessDecision, 'id' | 'madeAt' | 'iteration'>): void {
    this.state.decisions.push({
      ...decision,
      id: generateId(),
      madeAt: new Date(),
      iteration: this.state.iteration,
    });
    this.state.lastUpdatedAt = new Date();
  }

  /** Transition to a specific phase */
  setPhase(phase: HarnessState['phase']): void {
    this.state.phase = phase;
    this.state.lastUpdatedAt = new Date();
  }

  /** Get unmet criteria */
  getUnmetCriteria(): HarnessCriterion[] {
    return this.state.criteria.filter((c) => !c.met);
  }

  /** Get summary statistics */
  getSummary(): {
    totalCriteria: number;
    metCriteria: number;
    unmetCriteria: number;
    iteration: number;
    evidenceCount: number;
    decisionCount: number;
    phase: string;
  } {
    return {
      totalCriteria: this.state.criteria.length,
      metCriteria: this.state.criteria.filter((c) => c.met).length,
      unmetCriteria: this.state.criteria.filter((c) => !c.met).length,
      iteration: this.state.iteration,
      evidenceCount: this.state.evidence.length,
      decisionCount: this.state.decisions.length,
      phase: this.state.phase,
    };
  }
}
