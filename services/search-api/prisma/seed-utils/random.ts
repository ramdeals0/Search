/** Deterministic demo seed — keep in sync with seed.ts DEMO_RNG_SEED */
export const DEMO_RNG_SEED = 20260615;

export interface SeededRng {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T;
  shuffle<T>(items: readonly T[]): T[];
  bool(probability?: number): boolean;
}

/** Mulberry32 — fast, deterministic 32-bit PRNG */
export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;

  function next(): number {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    float(min: number, max: number): number {
      return min + next() * (max - min);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty array");
      }
      return items[Math.floor(next() * items.length)]!;
    },
    weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty array");
      }
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let roll = next() * total;
      for (let index = 0; index < items.length; index += 1) {
        roll -= weights[index] ?? 0;
        if (roll <= 0) {
          return items[index]!;
        }
      }
      return items[items.length - 1]!;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
      }
      return copy;
    },
    bool(probability = 0.5): boolean {
      return next() < probability;
    },
  };
}

export function seedId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(5, "0")}`;
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isoDateDaysAgo(rng: SeededRng, daysBack: number): string {
  const date = new Date("2026-03-15T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() - rng.int(0, daysBack));
  return date.toISOString();
}
