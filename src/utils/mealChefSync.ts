import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import type { Meal } from '../hooks/useFirebaseData';

/**
 * Automatically syncs a guest to any meal where their household is designated as a chef.
 * Ensures that if a member is added to a household that is set as chefs for a meal,
 * this new member is also recorded as a chef for that meal.
 */
export async function syncMemberToHouseholdMeals(
  eventId: string,
  guestId: string,
  householdId: string,
  meals: Meal[]
): Promise<void> {
  if (!eventId || !guestId || !householdId || !meals || meals.length === 0) return;

  const relevantMeals = meals.filter(
    m => m.householdChefIds && m.householdChefIds.includes(householdId)
  );

  for (const meal of relevantMeals) {
    if (!meal.chefIds?.includes(guestId)) {
      try {
        await updateDoc(doc(db, 'events', eventId, 'meals', meal.id), {
          chefIds: arrayUnion(guestId)
        });
      } catch (err) {
        console.error(`Failed to sync guest ${guestId} to meal ${meal.id}:`, err);
      }
    }
  }
}
