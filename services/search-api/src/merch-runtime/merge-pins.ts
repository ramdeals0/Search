import type { EvaluatedCandidate } from "./types.js";

function candidateKey(candidate: EvaluatedCandidate): string {
  return candidate.variantId
    ? `${candidate.productId}::${candidate.variantId}`
    : candidate.productId;
}

export function mergePinnedResults(
  pinned: EvaluatedCandidate[],
  normal: EvaluatedCandidate[],
): EvaluatedCandidate[] {
  if (pinned.length === 0) {
    return normal;
  }

  const usedKeys = new Set<string>();
  const pinByPosition = new Map<number, EvaluatedCandidate>();

  const sortedPinned = [...pinned].sort((a, b) => {
    const positionDelta =
      (a.appliedPinPosition ?? Number.MAX_SAFE_INTEGER) -
      (b.appliedPinPosition ?? Number.MAX_SAFE_INTEGER);
    if (positionDelta !== 0) {
      return positionDelta;
    }
    return b.finalScore - a.finalScore;
  });

  for (const candidate of sortedPinned) {
    const position = candidate.appliedPinPosition;
    if (position === undefined || position < 1 || pinByPosition.has(position)) {
      continue;
    }
    const key = candidateKey(candidate);
    if (usedKeys.has(key)) {
      continue;
    }
    pinByPosition.set(position, candidate);
    usedKeys.add(key);
  }

  const normalQueue = normal.filter(
    (candidate) => !usedKeys.has(candidateKey(candidate)),
  );
  const result: EvaluatedCandidate[] = [];
  let normalIndex = 0;
  const targetLength = normalQueue.length + pinByPosition.size;

  for (let slot = 1; slot <= targetLength; slot += 1) {
    const pinnedCandidate = pinByPosition.get(slot);
    if (pinnedCandidate) {
      result.push(pinnedCandidate);
      continue;
    }

    if (normalIndex < normalQueue.length) {
      result.push(normalQueue[normalIndex]!);
      normalIndex += 1;
    }
  }

  while (normalIndex < normalQueue.length) {
    result.push(normalQueue[normalIndex]!);
    normalIndex += 1;
  }

  return result;
}
