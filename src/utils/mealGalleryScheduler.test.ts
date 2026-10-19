import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGalleryTiming,
  buildGallerySchedule,
  sequenceMealsForPairMode,
  extractMealChefIds,
  GALLERY_CONSTANTS,
} from './mealGalleryScheduler.ts';
import type { Meal, Guest } from '../hooks/useFirebaseData.ts';

const mockGuest = (id: string, name: string): Guest => ({
  id,
  name,
  pin: '1234',
  status: 'not_logged_in',
  rsvpStatus: 'coming',
});

const mockMeal = (
  id: string,
  name: string,
  chefIds: string[] = [],
  householdChefIds: string[] = []
): Meal => ({
  id,
  name,
  description: `Description for ${name}`,
  imageUrl: `https://example.com/${id}.jpg`,
  chefIds,
  householdChefIds,
});

test('Timing: always uses 15s per meal and disables pair mode for null/idle timer', () => {
  const result = calculateGalleryTiming(6, null);
  assert.strictEqual(result.isPairMode, false);
  assert.strictEqual(result.slideDurationSec, 15);
  assert.strictEqual(result.slideCount, 6);
});

test('Timing: always uses 15s per meal and disables pair mode for long timer', () => {
  const result = calculateGalleryTiming(6, 120 * 1000);
  assert.strictEqual(result.isPairMode, false);
  assert.strictEqual(result.slideDurationSec, 15);
  assert.strictEqual(result.slideCount, 6);
});

test('Timing: maintains 15s per meal and disables pair mode even for short timer', () => {
  // Even with 45s or 20s timer, pair mode is never used and meal duration is 15s
  const result45 = calculateGalleryTiming(6, 45 * 1000);
  assert.strictEqual(result45.isPairMode, false);
  assert.strictEqual(result45.slideDurationSec, 15);
  assert.strictEqual(result45.slideCount, 6);

  const result20 = calculateGalleryTiming(6, 20 * 1000);
  assert.strictEqual(result20.isPairMode, false);
  assert.strictEqual(result20.slideDurationSec, 15);
  assert.strictEqual(result20.slideCount, 6);
});

test('Schedule (Single Meal Layout): buildGallerySchedule always produces single meal slides with 15s duration', () => {
  const guests = [
    mockGuest('g1', 'Chef Alice'),
    mockGuest('g2', 'Chef Bob'),
  ];
  const meals: Meal[] = [
    mockMeal('m1', 'Alice Meal 1', ['g1']),
    mockMeal('m2', 'Bob Meal 1', ['g2']),
    mockMeal('m3', 'Alice Meal 2', ['g1']),
    mockMeal('m4', 'Bob Meal 2', ['g2']),
  ];

  // Even with a tight timer that previously triggered pair mode:
  const slides = buildGallerySchedule({
    meals,
    guests,
    timerDurationMs: 20 * 1000,
  });

  assert.strictEqual(slides.length, 4);
  for (const slide of slides) {
    assert.strictEqual(slide.meals.length, 1, 'Each slide must contain exactly one meal');
    assert.strictEqual(slide.durationMs, 15000, 'Each meal slide duration must be 15000ms (15s)');
  }
});

test('Sequencing (Single Mode): never shows two meals of the same chefs consecutively', () => {
  const guests = [
    mockGuest('g1', 'Chef Alice'),
    mockGuest('g2', 'Chef Bob'),
    mockGuest('g3', 'Chef Charlie'),
  ];

  // 6 meals: 2 by Alice, 2 by Bob, 2 by Charlie
  const meals: Meal[] = [
    mockMeal('m1', 'Alice Meal 1', ['g1']),
    mockMeal('m2', 'Alice Meal 2', ['g1']),
    mockMeal('m3', 'Bob Meal 1', ['g2']),
    mockMeal('m4', 'Bob Meal 2', ['g2']),
    mockMeal('m5', 'Charlie Meal 1', ['g3']),
    mockMeal('m6', 'Charlie Meal 2', ['g3']),
  ];

  const slides = buildGallerySchedule({
    meals,
    guests,
    timerDurationMs: 120 * 1000,
  });

  assert.strictEqual(slides.length, 6);

  // Verify each slide has 1 meal and 15s duration
  for (const slide of slides) {
    assert.strictEqual(slide.meals.length, 1);
    assert.strictEqual(slide.durationMs, 15000);
  }

  // Verify no two adjacent meals share a chef (including circular wrap-around)
  for (let i = 0; i < slides.length; i++) {
    const nextIdx = (i + 1) % slides.length;
    const currentChefs = slides[i].meals[0].chefIds;
    const nextChefs = slides[nextIdx].meals[0].chefIds;

    const sharesChef = currentChefs.some((c) => nextChefs.includes(c));
    assert.strictEqual(
      sharesChef,
      false,
      `Slide ${i} (${slides[i].meals[0].name}) and Slide ${nextIdx} (${slides[nextIdx].meals[0].name}) share chef!`
    );
  }
});

test('Helper: sequenceMealsForPairMode correctly pairs meals without internal conflict when called directly', () => {
  const guests = [
    mockGuest('g1', 'Chef Alice'),
    mockGuest('g2', 'Chef Bob'),
    mockGuest('g3', 'Chef Charlie'),
    mockGuest('g4', 'Chef Dana'),
  ];

  const meals: Meal[] = [
    mockMeal('m1', 'Alice Meal 1', ['g1']),
    mockMeal('m2', 'Alice Meal 2', ['g1']),
    mockMeal('m3', 'Bob Meal 1', ['g2']),
    mockMeal('m4', 'Bob Meal 2', ['g2']),
    mockMeal('m5', 'Charlie Meal', ['g3']),
    mockMeal('m6', 'Dana Meal', ['g4']),
  ];

  const chefMap = new Map<string, Set<string>>();
  for (const meal of meals) {
    chefMap.set(meal.id, extractMealChefIds(meal, guests));
  }

  const pairs = sequenceMealsForPairMode(meals, chefMap);
  assert.strictEqual(pairs.length, 3);

  // Check that inside every slide, meals do not share a chef
  for (let i = 0; i < pairs.length; i++) {
    const slide = pairs[i];
    if (slide.length === 2) {
      const c0 = slide[0].chefIds;
      const c1 = slide[1].chefIds;
      assert.strictEqual(
        c0.some((c) => c1.includes(c)),
        false,
        `Within Slide ${i}, meals share chef!`
      );
    }
  }
});
