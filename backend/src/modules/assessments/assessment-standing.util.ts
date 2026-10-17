import { AttemptStatus } from '@prisma/client';
import { StudentAssessmentStatus } from './dto/student-assessment-response.dto';

/** One attempt, reduced to the fields a standing is computed from. */
export interface AttemptStandingInput {
  id: string;
  status: AttemptStatus;
  scorePercent: number | null;
  attemptNumber: number;
}

export interface AssessmentStanding {
  status: StudentAssessmentStatus;
  bestScorePercent: number | null;
  attemptsCount: number;
  latestAttemptId: string | null;
  /** The run a "view result" link should open: the best one, not the newest. */
  bestAttemptId: string | null;
}

/**
 * Where a student stands on one assessment, given every attempt they have made
 * at it. Retries are unlimited and the best score counts, so a pass anywhere
 * makes the standing PASSED; otherwise the latest attempt's status stands.
 *
 * Both the student's own assessment list and the staff view of a student's
 * progress read their standing from here, so the two can never disagree about
 * whether someone has passed or what their score was.
 */
export function computeAssessmentStanding(attempts: AttemptStandingInput[]): AssessmentStanding {
  const ordered = [...attempts].sort((a, b) => a.attemptNumber - b.attemptNumber);
  const latest = ordered[ordered.length - 1] ?? null;
  const passed = ordered.some((a) => a.status === AttemptStatus.PASSED);
  const scores = ordered
    .map((a) => a.scorePercent)
    .filter((s): s is number => s !== null && s !== undefined);

  const best = ordered.reduce<AttemptStandingInput | null>(
    (bestSoFar, attempt) =>
      attempt.scorePercent !== null &&
      (bestSoFar === null ||
        bestSoFar.scorePercent === null ||
        attempt.scorePercent > bestSoFar.scorePercent)
        ? attempt
        : bestSoFar,
    null,
  );

  return {
    status: !latest ? 'NOT_STARTED' : passed ? AttemptStatus.PASSED : latest.status,
    bestScorePercent: scores.length > 0 ? Math.max(...scores) : null,
    attemptsCount: ordered.length,
    latestAttemptId: latest?.id ?? null,
    bestAttemptId: best?.id ?? latest?.id ?? null,
  };
}
