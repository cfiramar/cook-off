/**
 * @file mealGalleryScheduler.ts
 * @description Domain service for calculating slide display durations and sequencing meals
 * in View Mode to prevent consecutive appearances of meals by the same chefs and ensure
 * optimal display pacing based on event timer constraints.
 */

import type { Meal, Guest } from '../hooks/useFirebaseData';

/**
 * Configuration constants for gallery pacing and sequencing algorithms.
 * Explicit values avoid magic numbers throughout the codebase.
 */
export const GALLERY_CONSTANTS = {
  /** Fixed display duration for each meal/slide in seconds */
  MEAL_DURATION_SEC: 15,
  /** Minimum display duration for backward compatibility */
  MIN_MEAL_DURATION_SEC: 15,
  /** Maximum display duration for backward compatibility */
  MAX_MEAL_DURATION_SEC: 15,
  /** Default display duration in seconds */
  DEFAULT_IDLE_DURATION_SEC: 15,
  /** Safety limit on backtracking search steps to avoid blocking main thread */
  MAX_SEARCH_ITERATIONS: 3000,
} as const;

/**
 * Result of timing calculations for the rotating gallery.
 */
export interface GalleryTimingResult {
  /** True if two meals should be shown simultaneously side-by-side */
  isPairMode: boolean;
  /** Display duration per slide in seconds */
  slideDurationSec: number;
  /** Total number of slides in the rotation cycle */
  slideCount: number;
}

/**
 * A scheduled slide in the rotating gallery.
 */
export interface ScheduledMealSlide {
  /** Unique key for React animations */
  id: string;
  /** Array containing 1 meal (single mode or odd pair tail) or 2 meals (pair mode) */
  meals: Meal[];
  /** Duration in milliseconds for this slide */
  durationMs: number;
}

/**
 * Parameters for building the gallery schedule.
 */
export interface GalleryScheduleConfig {
  meals: Meal[];
  guests: Guest[];
  timerDurationMs?: number | null;
  timerStatus?: 'idle' | 'running' | 'ended';
}

/**
 * Extracts all unique attending chef identifiers for a meal.
 * Accounts for direct chefIds and householdChefIds, filtering out guests
 * who have RSVP'd as 'not_coming'.
 *
 * @param meal The meal to evaluate
 * @param guests The list of guests for household and RSVP lookup
 * @returns Set of chef IDs associated with the meal
 */
export function extractMealChefIds(meal: Meal, guests: Guest[]): Set<string> {
  const directChefIds = Array.isArray(meal.chefIds) ? meal.chefIds : [];
  const householdChefIds = Array.isArray(meal.householdChefIds) ? meal.householdChefIds : [];

  const householdMemberIds = householdChefIds.flatMap((hId) =>
    guests.filter((g) => g.householdId === hId).map((g) => g.id)
  );

  const combinedChefIds = Array.from(new Set([...directChefIds, ...householdMemberIds]));

  // If guests exist, filter out non-attending guests
  if (guests && guests.length > 0) {
    const attendingIds = combinedChefIds.filter((id) => {
      const guest = guests.find((g) => g.id === id);
      return !guest || guest.rsvpStatus !== 'not_coming';
    });
    if (attendingIds.length > 0) {
      return new Set(attendingIds);
    }
  }

  // Fallback to direct chefIds if guests not loaded or no RSVP info
  return new Set(combinedChefIds);
}

/**
 * Checks whether two meals share one or more chefs.
 *
 * @param mealA First meal
 * @param mealB Second meal
 * @param chefMap Map from meal ID to its set of chef IDs
 * @returns True if the meals share at least one chef, false otherwise
 */
export function doMealsConflict(
  mealA: Meal,
  mealB: Meal,
  chefMap: Map<string, Set<string>>
): boolean {
  if (mealA.id === mealB.id) return true;
  const chefsA = chefMap.get(mealA.id);
  const chefsB = chefMap.get(mealB.id);

  if (!chefsA || !chefsB || chefsA.size === 0 || chefsB.size === 0) {
    return false;
  }

  for (const chefId of chefsA) {
    if (chefsB.has(chefId)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates display timing for meals in View Mode.
 *
 * Requirements:
 * - The time for each meal should be 15 seconds.
 * - Never show 2 meals one next to each other (single meal layout only, pair mode disabled).
 *
 * @param mealCount Number of meals
 * @param _timerDurationMs Optional timer duration (unused as duration is fixed at 15s)
 * @returns Timing calculation result
 */
export function calculateGalleryTiming(
  mealCount: number,
  _timerDurationMs?: number | null
): GalleryTimingResult {
  if (mealCount <= 0) {
    return {
      isPairMode: false,
      slideDurationSec: GALLERY_CONSTANTS.MEAL_DURATION_SEC,
      slideCount: 0,
    };
  }

  return {
    isPairMode: false,
    slideDurationSec: GALLERY_CONSTANTS.MEAL_DURATION_SEC,
    slideCount: mealCount,
  };
}

/**
 * Sequences meals in single mode such that no two meals of the same chefs appear consecutively.
 * Uses Depth-First Search with Most Remaining Values (MRV) heuristic and circular wrap-around validation.
 *
 * @param meals List of meals to sequence
 * @param chefMap Map from meal ID to chef IDs
 * @returns Ordered meals array
 */
export function sequenceMealsForSingleMode(
  meals: Meal[],
  chefMap: Map<string, Set<string>>
): Meal[] {
  const n = meals.length;
  if (n <= 2) return [...meals];

  // Count chef frequencies to prioritize most-constrained meals first
  const chefCounts = new Map<string, number>();
  for (const meal of meals) {
    const chefs = chefMap.get(meal.id);
    if (chefs) {
      for (const c of chefs) {
        chefCounts.set(c, (chefCounts.get(c) || 0) + 1);
      }
    }
  }

  const getMealWeight = (meal: Meal): number => {
    const chefs = chefMap.get(meal.id);
    if (!chefs || chefs.size === 0) return 0;
    let maxCount = 0;
    for (const c of chefs) {
      maxCount = Math.max(maxCount, chefCounts.get(c) || 0);
    }
    return maxCount;
  };

  // Sort initial candidates by constraint descending
  const sortedMeals = [...meals].sort((a, b) => getMealWeight(b) - getMealWeight(a));

  let iterations = 0;
  let bestCircularPath: Meal[] | null = null;
  let bestLinearPath: Meal[] | null = null;

  const dfs = (currentPath: Meal[], remaining: Meal[]) => {
    if (bestCircularPath) return; // Found optimal solution

    iterations++;
    if (iterations > GALLERY_CONSTANTS.MAX_SEARCH_ITERATIONS) {
      return;
    }

    if (remaining.length === 0) {
      const isCircularSafe = !doMealsConflict(currentPath[n - 1], currentPath[0], chefMap);
      if (isCircularSafe) {
        bestCircularPath = [...currentPath];
        return;
      }

      if (!bestLinearPath) {
        bestLinearPath = [...currentPath];
      }
      return;
    }

    const prev = currentPath[currentPath.length - 1];

    // Partition remaining into non-conflicting candidates vs conflicting candidates
    const validCandidates = remaining.filter((m) => !doMealsConflict(prev, m, chefMap));

    // If at the last step, prioritize candidates that also don't conflict with start
    if (remaining.length === 1 && validCandidates.length > 0) {
      validCandidates.sort((a, b) => {
        const aCircular = !doMealsConflict(a, currentPath[0], chefMap) ? 1 : 0;
        const bCircular = !doMealsConflict(b, currentPath[0], chefMap) ? 1 : 0;
        return bCircular - aCircular;
      });
    } else {
      // Sort candidates by most constrained remaining chef first (MRV heuristic)
      validCandidates.sort((a, b) => getMealWeight(b) - getMealWeight(a));
    }

    for (const candidate of validCandidates) {
      currentPath.push(candidate);
      dfs(
        currentPath,
        remaining.filter((m) => m.id !== candidate.id)
      );
      currentPath.pop();
      if (bestCircularPath) return;
    }
  };

  // Try starting from the most constrained meals
  for (let i = 0; i < Math.min(sortedMeals.length, 5); i++) {
    const startMeal = sortedMeals[i];
    const remaining = sortedMeals.filter((m) => m.id !== startMeal.id);
    dfs([startMeal], remaining);
    if (bestCircularPath) return bestCircularPath;
  }

  if (bestLinearPath) {
    return bestLinearPath;
  }

  // Fallback: greedy construction minimizing conflicts
  const greedyPath: Meal[] = [sortedMeals[0]];
  const pool = sortedMeals.slice(1);

  while (pool.length > 0) {
    const prev = greedyPath[greedyPath.length - 1];
    let bestIndex = 0;
    let minConflictScore = Infinity;

    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      const conflictScore = doMealsConflict(prev, cand, chefMap) ? 10 : 0;
      if (conflictScore < minConflictScore) {
        minConflictScore = conflictScore;
        bestIndex = i;
      }
    }

    greedyPath.push(pool[bestIndex]);
    pool.splice(bestIndex, 1);
  }

  return greedyPath;
}

/**
 * Sequences meals in pair mode into slides of 2 meals (or 1 for the odd tail).
 * Ensures:
 * 1. Meals in the same slide do not share chefs.
 * 2. Consecutive slides do not share chefs.
 * 3. Wrap-around between the last slide and the first slide minimizes or eliminates chef overlap.
 *
 * @param meals List of meals to sequence
 * @param chefMap Map from meal ID to chef IDs
 * @returns Array of meal pairs / groups per slide
 */
export function sequenceMealsForPairMode(
  meals: Meal[],
  chefMap: Map<string, Set<string>>
): Meal[][] {
  const n = meals.length;
  if (n <= 1) return meals.map((m) => [m]);

  // Helper to get all chefs in a set of meals
  const getSlideChefs = (slideMeals: Meal[]): Set<string> => {
    const chefs = new Set<string>();
    for (const m of slideMeals) {
      const mChefs = chefMap.get(m.id);
      if (mChefs) {
        for (const c of mChefs) chefs.add(c);
      }
    }
    return chefs;
  };

  const countSlideOverlap = (slideA: Meal[], slideB: Meal[]): number => {
    const chefsA = getSlideChefs(slideA);
    const chefsB = getSlideChefs(slideB);
    if (chefsA.size === 0 || chefsB.size === 0) return 0;
    let count = 0;
    for (const c of chefsA) {
      if (chefsB.has(c)) count++;
    }
    return count;
  };

  const countTotalConflicts = (slides: Meal[][]): number => {
    let linearConflicts = 0;
    for (let i = 0; i < slides.length - 1; i++) {
      linearConflicts += countSlideOverlap(slides[i], slides[i + 1]);
    }
    const circularConflicts =
      slides.length > 2 ? countSlideOverlap(slides[slides.length - 1], slides[0]) : 0;
    return linearConflicts * 10 + circularConflicts;
  };

  // Chef frequency count
  const chefCounts = new Map<string, number>();
  for (const m of meals) {
    const chefs = chefMap.get(m.id);
    if (chefs) {
      for (const c of chefs) {
        chefCounts.set(c, (chefCounts.get(c) || 0) + 1);
      }
    }
  }

  const getMealWeight = (meal: Meal): number => {
    const chefs = chefMap.get(meal.id);
    if (!chefs || chefs.size === 0) return 0;
    let max = 0;
    for (const c of chefs) max = Math.max(max, chefCounts.get(c) || 0);
    return max;
  };

  const sortedMeals = [...meals].sort((a, b) => getMealWeight(b) - getMealWeight(a));

  let iterations = 0;
  let bestSlides: Meal[][] | null = null;
  let minConflicts = Infinity;

  const dfs = (currentSlides: Meal[][], remaining: Meal[]) => {
    if (minConflicts === 0) return; // Optimal solution found

    iterations++;
    if (iterations > GALLERY_CONSTANTS.MAX_SEARCH_ITERATIONS) {
      return;
    }

    if (remaining.length === 0) {
      const conflicts = countTotalConflicts(currentSlides);
      if (conflicts < minConflicts) {
        minConflicts = conflicts;
        bestSlides = currentSlides.map((s) => [...s]);
      }
      return;
    }

    const prevSlide = currentSlides.length > 0 ? currentSlides[currentSlides.length - 1] : null;

    if (remaining.length === 1) {
      const oddSlide = [remaining[0]];
      currentSlides.push(oddSlide);
      dfs(currentSlides, []);
      currentSlides.pop();
      return;
    }

    // Build all candidate pairs from remaining
    interface CandidatePair {
      first: Meal;
      second: Meal;
      prevOverlap: number;
      weight: number;
    }

    const candidatePairs: CandidatePair[] = [];

    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const m1 = remaining[i];
        const m2 = remaining[j];

        // Meals in the same slide must not share a chef
        if (doMealsConflict(m1, m2, chefMap)) continue;

        const pairMeals = [m1, m2];
        const prevOverlap = prevSlide ? countSlideOverlap(prevSlide, pairMeals) : 0;
        const weight = getMealWeight(m1) + getMealWeight(m2);

        candidatePairs.push({
          first: m1,
          second: m2,
          prevOverlap,
          weight,
        });
      }
    }

    // If no non-conflicting pairs can be made from remaining (very rare edge case)
    if (candidatePairs.length === 0) {
      const fallbackPair = [remaining[0], remaining[1]];
      currentSlides.push(fallbackPair);
      dfs(currentSlides, remaining.slice(2));
      currentSlides.pop();
      return;
    }

    // Sort candidate pairs:
    // 1. Zero overlap with prevSlide first
    // 2. Higher weight (most constrained chefs) first
    candidatePairs.sort((a, b) => {
      if (a.prevOverlap !== b.prevOverlap) {
        return a.prevOverlap - b.prevOverlap;
      }
      return b.weight - a.weight;
    });

    // Explore top candidates
    const branchLimit = Math.min(candidatePairs.length, 12);
    for (let k = 0; k < branchLimit; k++) {
      const pair = candidatePairs[k];
      currentSlides.push([pair.first, pair.second]);
      const nextRemaining = remaining.filter(
        (m) => m.id !== pair.first.id && m.id !== pair.second.id
      );
      dfs(currentSlides, nextRemaining);
      currentSlides.pop();
      if (minConflicts === 0) return;
    }
  };

  dfs([], sortedMeals);

  if (bestSlides) {
    return bestSlides;
  }

  // Fallback chunking
  const fallback: Meal[][] = [];
  for (let i = 0; i < meals.length; i += 2) {
    if (i + 1 < meals.length) {
      fallback.push([meals[i], meals[i + 1]]);
    } else {
      fallback.push([meals[i]]);
    }
  }
  return fallback;
}

/**
 * Builds the complete schedule of slides with timing and chef-ordered meals.
 * Always schedules exactly 1 meal per slide for 15 seconds duration.
 *
 * @param config Schedule configuration
 * @returns Array of scheduled slides
 */
export function buildGallerySchedule(config: GalleryScheduleConfig): ScheduledMealSlide[] {
  const { meals, guests } = config;

  if (!meals || meals.length === 0) {
    return [];
  }

  // Pre-calculate chef sets for all meals
  const chefMap = new Map<string, Set<string>>();
  for (const meal of meals) {
    chefMap.set(meal.id, extractMealChefIds(meal, guests));
  }

  // Fixed 15 seconds timing per meal (pair mode disabled)
  const timing = calculateGalleryTiming(meals.length);
  const durationMs = timing.slideDurationSec * 1000;

  // Single mode: sequence meals to avoid consecutive appearances by the same chefs
  const orderedMeals = sequenceMealsForSingleMode(meals, chefMap);
  return orderedMeals.map((meal, index) => ({
    id: `single-${index}-${meal.id}`,
    meals: [meal],
    durationMs,
  }));
}
