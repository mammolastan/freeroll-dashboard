import { ScoringSystemConfig, DEFAULT_SCORING_SYSTEM } from '@/types/league-config';

/**
 * Returns the placement points for a given finishing position.
 * Falls back to DEFAULT_SCORING_SYSTEM if no config is provided.
 */
export function getPointsForPlacement(
  placement: number,
  scoringSystem?: ScoringSystemConfig | null
): number {
  const config = scoringSystem ?? DEFAULT_SCORING_SYSTEM;
  const rule = config.rules.find(r => r.placement === placement);
  return rule?.points ?? config.defaultPoints;
}

/**
 * Validates a ScoringSystemConfig object.
 * Returns an array of error strings (empty = valid).
 */
export function validateScoringSystem(config: ScoringSystemConfig): string[] {
  const errors: string[] = [];

  if (!Array.isArray(config.rules) || config.rules.length === 0) {
    errors.push('Scoring system must have at least one rule.');
    return errors;
  }

  if (typeof config.defaultPoints !== 'number' || config.defaultPoints < 0 || !Number.isInteger(config.defaultPoints)) {
    errors.push('Default points must be a non-negative integer.');
  }

  const placements = config.rules.map(r => r.placement);
  const uniquePlacements = new Set(placements);
  if (uniquePlacements.size !== placements.length) {
    errors.push('Duplicate placements found. Each placement may only appear once.');
  }

  config.rules.forEach((rule, i) => {
    if (!Number.isInteger(rule.placement) || rule.placement < 1) {
      errors.push(`Rule ${i + 1}: placement must be a positive integer.`);
    }
    if (!Number.isInteger(rule.points) || rule.points < 0) {
      errors.push(`Rule ${i + 1}: points must be a non-negative integer.`);
    }
  });

  return errors;
}
