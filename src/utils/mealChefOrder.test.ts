import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOrderedChefsForMeal,
  getOrderedChefNamesForMeal,
  getHouseholdNameForGuest,
  sortChefs,
} from './mealChefOrder.ts';
import type { Guest, Meal } from '../hooks/useFirebaseData.ts';

const createGuest = (overrides: Partial<Guest> & { id: string; name: string }): Guest => ({
  pin: '1234',
  status: 'not_logged_in',
  rsvpStatus: 'coming',
  ...overrides,
});

const createMeal = (overrides: Partial<Meal> & { id: string; name: string }): Meal => ({
  description: 'Test meal description',
  imageUrl: 'https://example.com/test.jpg',
  chefIds: [],
  householdChefIds: [],
  ...overrides,
});

test('mealChefOrder: sorts chefs from different households by household name (a-z)', () => {
  const guests: Guest[] = [
    createGuest({
      id: 'g_levi_1',
      name: 'אבי',
      householdId: 'hh_levi',
      householdName: 'משפחת לוי',
      order: 0,
    }),
    createGuest({
      id: 'g_abraham_1',
      name: 'שרה',
      householdId: 'hh_abraham',
      householdName: 'משפחת אברהם',
      order: 0,
    }),
    createGuest({
      id: 'g_cohen_1',
      name: 'דוד',
      householdId: 'hh_cohen',
      householdName: 'משפחת כהן',
      order: 0,
    }),
  ];

  const meal = createMeal({
    id: 'm1',
    name: 'מרק משותף',
    chefIds: ['g_levi_1', 'g_abraham_1', 'g_cohen_1'],
  });

  const names = getOrderedChefNamesForMeal(meal, guests);

  // Hebrew alphabetical: אברהם, כהן, לוי
  assert.deepStrictEqual(names, ['שרה', 'דוד', 'אבי']);
});

test('mealChefOrder: sorts inner members of a household by the planner order', () => {
  const guests: Guest[] = [
    createGuest({
      id: 'g1',
      name: 'אבי (ראשון במקור)',
      householdId: 'hh_barak',
      householdName: 'משפחת ברק',
      order: 1, // Planner moved down
    }),
    createGuest({
      id: 'g2',
      name: 'גלית (הועלתה למעלה)',
      householdId: 'hh_barak',
      householdName: 'משפחת ברק',
      order: 0, // Planner moved up
    }),
  ];

  const meal = createMeal({
    id: 'm1',
    name: 'סלט ברק',
    householdChefIds: ['hh_barak'],
  });

  const names = getOrderedChefNamesForMeal(meal, guests);

  // Even though 'אבי' comes before 'גלית' alphabetically, planner order 0 comes before 1
  assert.deepStrictEqual(names, ['גלית (הועלתה למעלה)', 'אבי (ראשון במקור)']);
});

test('mealChefOrder: combines multiple households with inner member ordering', () => {
  const guests: Guest[] = [
    // Household תמר (comes later A-Z)
    createGuest({
      id: 't2',
      name: 'תמר ב׳',
      householdId: 'hh_tamar',
      householdName: 'תמר',
      order: 1,
    }),
    createGuest({
      id: 't1',
      name: 'תמר א׳',
      householdId: 'hh_tamar',
      householdName: 'תמר',
      order: 0,
    }),

    // Household אלון (comes first A-Z)
    createGuest({
      id: 'a2',
      name: 'אלון ב׳',
      householdId: 'hh_alon',
      householdName: 'אלון',
      order: 1,
    }),
    createGuest({
      id: 'a1',
      name: 'אלון א׳',
      householdId: 'hh_alon',
      householdName: 'אלון',
      order: 0,
    }),
  ];

  const meal = createMeal({
    id: 'm1',
    name: 'קדירה',
    householdChefIds: ['hh_tamar', 'hh_alon'],
  });

  const names = getOrderedChefNamesForMeal(meal, guests);

  // אלון household first (with אלון א׳ then אלון ב׳), then תמר household (with תמר א׳ then תמר ב׳)
  assert.deepStrictEqual(names, ['אלון א׳', 'אלון ב׳', 'תמר א׳', 'תמר ב׳']);
});

test('mealChefOrder: handles standalone guests without householdId properly', () => {
  const guests: Guest[] = [
    createGuest({
      id: 'ind_ziv',
      name: 'זיו',
    }),
    createGuest({
      id: 'g_ben',
      name: 'בנימין',
      householdId: 'hh_ben',
      householdName: 'בית בנימין',
      order: 0,
    }),
    createGuest({
      id: 'ind_alon',
      name: 'אלון יחיד',
    }),
  ];

  const meal = createMeal({
    id: 'm1',
    name: 'מנה מעורבת',
    chefIds: ['ind_ziv', 'g_ben', 'ind_alon'],
  });

  const names = getOrderedChefNamesForMeal(meal, guests);

  // Household names:
  // אלון יחיד -> "אלון יחיד"
  // בנימין -> "בית בנימין"
  // זיו -> "זיו"
  // A-Z: אלון יחיד, בית בנימין, זיו
  assert.deepStrictEqual(names, ['אלון יחיד', 'בנימין', 'זיו']);
});

test('mealChefOrder: filters out not_coming guests when filterAttendingOnly is true', () => {
  const guests: Guest[] = [
    createGuest({
      id: 'g1',
      name: 'אבי',
      householdId: 'hh_1',
      householdName: 'משפחת 1',
      rsvpStatus: 'not_coming',
      order: 0,
    }),
    createGuest({
      id: 'g2',
      name: 'דנה',
      householdId: 'hh_1',
      householdName: 'משפחת 1',
      rsvpStatus: 'coming',
      order: 1,
    }),
  ];

  const meal = createMeal({
    id: 'm1',
    name: 'מנה',
    householdChefIds: ['hh_1'],
  });

  const names = getOrderedChefNamesForMeal(meal, guests, { filterAttendingOnly: true });
  assert.deepStrictEqual(names, ['דנה']);
});

test('mealChefOrder: handles empty inputs gracefully', () => {
  assert.deepStrictEqual(getOrderedChefNamesForMeal(undefined, []), []);
  const meal = createMeal({ id: 'm1', name: 'Test' });
  assert.deepStrictEqual(getOrderedChefNamesForMeal(meal, []), []);
});
