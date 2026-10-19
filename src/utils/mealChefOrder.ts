/**
 * @file mealChefOrder.ts
 * @description Domain utility for sorting chefs of a meal according to:
 * 1. Different households: ordered by household name alphabetically (A-Z in Hebrew/locale).
 * 2. Inner order within each household: ordered exactly as they appear in the guests list
 *    (respecting the planner's custom reordering via member `order` property).
 */

import type { Guest, Meal } from '../hooks/useFirebaseData';

/**
 * Resolves the display household name for a guest.
 * If the guest has a householdId, attempts to find the household name from the guest
 * or any sibling member sharing the same householdId.
 * Falls back to the guest's own name if no householdName is specified.
 */
export function getHouseholdNameForGuest(guest: Guest, allGuests: Guest[]): string {
  if (guest.householdName && guest.householdName.trim()) {
    return guest.householdName.trim();
  }
  if (guest.householdId) {
    const siblingWithHhName = allGuests.find(
      (g) => g.householdId === guest.householdId && g.householdName && g.householdName.trim()
    );
    if (siblingWithHhName && siblingWithHhName.householdName) {
      return siblingWithHhName.householdName.trim();
    }
  }
  return guest.name.trim();
}

/**
 * Resolves the household identifier for grouping guests.
 * Standalone guests without an explicit householdId receive an individual key.
 */
export function getHouseholdIdForGuest(guest: Guest): string {
  return guest.householdId || `ind_${guest.id}`;
}

/**
 * Compares two members of the SAME household according to their guest list order:
 * 1. Primary: `order` property set when reordered in the guests list (0, 1, 2...).
 * 2. Secondary: Index in the raw guests array.
 * 3. Fallback: Alphabetical by name.
 */
export function compareHouseholdMembers(a: Guest, b: Guest, allGuests: Guest[]): number {
  const orderA = typeof a.order === 'number' ? a.order : undefined;
  const orderB = typeof b.order === 'number' ? b.order : undefined;

  if (orderA !== undefined && orderB !== undefined) {
    if (orderA !== orderB) return orderA - orderB;
  } else if (orderA !== undefined) {
    return -1;
  } else if (orderB !== undefined) {
    return 1;
  }

  // Preserve appearance order from the guests array
  const idxA = allGuests.findIndex((g) => g.id === a.id);
  const idxB = allGuests.findIndex((g) => g.id === b.id);
  if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
    return idxA - idxB;
  }

  return a.name.localeCompare(b.name, 'he');
}

/**
 * Sorts an array of chef Guest objects based on:
 * 1. Different households: by household name (A-Z).
 * 2. Same household: by inner order (as reordered in the guests list).
 */
export function sortChefs(chefs: Guest[], allGuests: Guest[]): Guest[] {
  return [...chefs].sort((a, b) => {
    const hhIdA = getHouseholdIdForGuest(a);
    const hhIdB = getHouseholdIdForGuest(b);

    if (hhIdA !== hhIdB) {
      const hhNameA = getHouseholdNameForGuest(a, allGuests);
      const hhNameB = getHouseholdNameForGuest(b, allGuests);
      const comp = hhNameA.localeCompare(hhNameB, 'he');
      if (comp !== 0) return comp;
      return hhIdA.localeCompare(hhIdB);
    }

    return compareHouseholdMembers(a, b, allGuests);
  });
}

export interface GetOrderedChefsOptions {
  /** If true, filters out guests whose rsvpStatus is 'not_coming' */
  filterAttendingOnly?: boolean;
}

/**
 * Resolves all chef Guest objects for a given meal and sorts them by:
 * 1. Different households: by household name (a-z).
 * 2. Inner order (in household): the same order as in the guests list.
 *
 * @param meal The meal to resolve chefs for
 * @param guests All guests in the event
 * @param options Configuration options
 * @returns Sorted array of chef Guest objects
 */
export function getOrderedChefsForMeal(
  meal: Meal | undefined,
  guests: Guest[],
  options: GetOrderedChefsOptions = {}
): Guest[] {
  if (!meal || !guests || guests.length === 0) return [];

  const directChefIds = Array.isArray(meal.chefIds) ? meal.chefIds : [];
  const householdChefIds = Array.isArray(meal.householdChefIds) ? meal.householdChefIds : [];

  const householdMemberIds = householdChefIds.flatMap((hId) =>
    guests.filter((g) => g.householdId === hId).map((g) => g.id)
  );

  const combinedChefIds = Array.from(new Set([...directChefIds, ...householdMemberIds]));

  let chefGuests = combinedChefIds
    .map((id) => guests.find((g) => g.id === id))
    .filter((g): g is Guest => Boolean(g));

  if (options.filterAttendingOnly) {
    chefGuests = chefGuests.filter((g) => g.rsvpStatus !== 'not_coming');
  }

  return sortChefs(chefGuests, guests);
}

/**
 * Returns the sorted chef names for a given meal.
 *
 * @param meal The meal to resolve chefs for
 * @param guests All guests in the event
 * @param options Configuration options
 * @returns Array of chef names in the required order
 */
export function getOrderedChefNamesForMeal(
  meal: Meal | undefined,
  guests: Guest[],
  options: GetOrderedChefsOptions = {}
): string[] {
  return getOrderedChefsForMeal(meal, guests, options).map((g) => g.name);
}
