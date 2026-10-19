import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_KEY_ROWS,
  calculateKeyRowValues,
  calculateGroceryList,
  calculateSliderMilestones,
  parseNumericInput,
  getSpiritConsumptionGuide,
  getActiveDefaultValue,
  formatGroceryUnit
} from './groceryKeyData.ts';
import type { Guest } from '../hooks/useFirebaseData.ts';

describe('groceryKeyData - Key and Grocery List calculations', () => {
  it('has all definitions in DEFAULT_KEY_ROWS with valid categories', () => {
    assert.strictEqual(DEFAULT_KEY_ROWS.length, 36);
    const categories = new Set(DEFAULT_KEY_ROWS.map(r => r.category));
    assert.ok(categories.has('מנות אורחים'));
    assert.ok(categories.has('מנות שלי'));
    assert.ok(categories.has('קינוחים שלי'));
    assert.ok(categories.has('ירקות'));
    assert.ok(categories.has('חטיפים'));
    assert.ok(categories.has('שתייה חריפה'));
    assert.ok(categories.has('שתייה קלה'));
  });

  it('ensures no formulaDisplay contains an "=" sign', () => {
    for (const row of DEFAULT_KEY_ROWS) {
      if (row.formulaDisplay) {
        assert.ok(!row.formulaDisplay.includes('='), `Row ${row.id} formulaDisplay contains '=': ${row.formulaDisplay}`);
      }
    }
  });

  it('calculates default keys correctly including sub-formulas and spirits', () => {
    const computed = calculateKeyRowValues(DEFAULT_KEY_ROWS, {});
    // Guest dishes
    assert.strictEqual(computed['appetizer'], 0.03);
    assert.strictEqual(computed['salad_guest'], 0.12);
    assert.strictEqual(computed['main_guest'], 0.4);
    assert.strictEqual(computed['dessert_guest'], 0.2);

    // Host dishes
    assert.ok(Math.abs(computed['focaccia'] - (1 / 6)) < 0.0001);
    assert.ok(Math.abs(computed['quiche'] - (1 / 12)) < 0.0001);
    assert.strictEqual(computed['mini_pizza'], 1.75);
    assert.strictEqual(computed['salad_meal'], 0.125);

    // Desserts
    assert.strictEqual(computed['cake'], 0.1);
    assert.strictEqual(computed['choco_balls'], 2.5);

    // Vegetables
    assert.ok(Math.abs(computed['cucumber'] - (0.35 / 3)) < 0.0001);
    assert.ok(Math.abs(computed['cherry_tomatoes'] - 1.5) < 0.0001);

    // Beer key: 0.8 * 1.5 = 1.2
    assert.ok(Math.abs(computed['beer'] - 1.2) < 0.0001);

    // Wine key: 0.2 * (1.5 / 5) = 0.06
    assert.ok(Math.abs(computed['wine'] - 0.06) < 0.0001);

    // Spirits keys:
    // Vodka: (0.1 * 1.25) / 16 = 0.0078125
    assert.ok(Math.abs(computed['vodka'] - (0.1 * 1.25 / 16)) < 0.0001);
    // Tequila: (0.05 * 1.25) / 16 = 0.00390625
    assert.ok(Math.abs(computed['tequila'] - (0.05 * 1.25 / 16)) < 0.0001);
    // Rum: (0.03 * 1.25) / 16 = 0.00234375
    assert.ok(Math.abs(computed['rum'] - (0.03 * 1.25 / 16)) < 0.0001);

    // Soft drinks bottle conversion: (2 * 0.24) / 1.5 = 0.32
    assert.ok(Math.abs(computed['soft_drinks_bottles_per_person'] - 0.32) < 0.0001);
    // Coke: 0.32 / 3
    assert.ok(Math.abs(computed['coke'] - (0.32 / 3)) < 0.0001);
  });

  it('matches grocery-list values for N = 29 and handles spirits with minimum 1 bottle', () => {
    const computedKeys = calculateKeyRowValues(DEFAULT_KEY_ROWS, {});
    const items = calculateGroceryList(computedKeys, 29);

    assert.strictEqual(items.length, 26);

    const byId = Object.fromEntries(items.map(i => [i.id, i]));

    // Check Guest Dishes
    assert.strictEqual(Number(byId['appetizer'].calculatedAmount.toFixed(2)), 0.87);
    assert.strictEqual(Number(byId['salad_guest'].calculatedAmount.toFixed(2)), 3.48);
    assert.strictEqual(Number(byId['main_guest'].calculatedAmount.toFixed(2)), 11.6);
    assert.strictEqual(Number(byId['dessert_guest'].calculatedAmount.toFixed(2)), 5.8);

    // Check Host Dishes
    assert.ok(Math.abs(byId['focaccia'].calculatedAmount - 4.8333) < 0.01);
    assert.ok(Math.abs(byId['quiche'].calculatedAmount - 2.4166) < 0.01);
    assert.strictEqual(byId['mini_pizza'].recommendedPurchase, 51);
    assert.strictEqual(byId['salad_meal'].calculatedAmount, 3.625);

    // Check Desserts
    assert.strictEqual(Number(byId['cake'].calculatedAmount.toFixed(1)), 2.9);
    assert.strictEqual(byId['cake'].unit, 'פסים');
    assert.strictEqual(byId['choco_balls'].recommendedPurchase, 73);
    assert.strictEqual(formatGroceryUnit('פס', 1), 'פס');
    assert.strictEqual(formatGroceryUnit('פס', 2), 'פסים');

    // Check Vegetables
    assert.ok(Math.abs(byId['cucumber'].calculatedAmount - 3.3833) < 0.01);
    assert.strictEqual(byId['cherry_tomatoes'].calculatedAmount, 43.5);

    // Check Snacks
    assert.strictEqual(Number(byId['bamba'].calculatedAmount.toFixed(2)), 3.77);
    assert.strictEqual(Number(byId['chips'].calculatedAmount.toFixed(2)), 3.77);

    // Check Alcohol
    assert.strictEqual(byId['beer'].recommendedPurchase, 35);
    assert.strictEqual(byId['beer'].unit, 'בקבוקים');
    assert.strictEqual(Number(byId['wine'].calculatedAmount.toFixed(2)), 1.74);

    // Vodka, Tequila, Rum: always at least 1 bottle in recommended purchase
    assert.strictEqual(byId['vodka'].recommendedPurchase, 1);
    assert.strictEqual(byId['tequila'].recommendedPurchase, 1);
    assert.strictEqual(byId['rum'].recommendedPurchase, 1);

    // Consumption fraction for N=29: 29 * 0.0078125 = 0.226 -> 1/4 bottle is enough!
    assert.strictEqual(byId['vodka'].consumptionGuide, 'מספיק 1/4 בקבוק');

    // Soft Drinks
    assert.ok(Math.abs(byId['coke'].calculatedAmount - 3.0933) < 0.01);
    assert.ok(Math.abs(byId['juice_orange'].calculatedAmount - 1.5466) < 0.01);
  });

  it('evaluates spirit consumption guide across party sizes', () => {
    // 1/4 bottle is enough
    assert.strictEqual(getSpiritConsumptionGuide(0.2), 'מספיק 1/4 בקבוק');
    assert.strictEqual(getSpiritConsumptionGuide(0.25), 'מספיק 1/4 בקבוק');

    // 1/2 bottle is enough
    assert.strictEqual(getSpiritConsumptionGuide(0.35), 'מספיק 1/2 בקבוק');
    assert.strictEqual(getSpiritConsumptionGuide(0.50), 'מספיק 1/2 בקבוק');

    // 3/4 bottle is enough
    assert.strictEqual(getSpiritConsumptionGuide(0.65), 'מספיק 3/4 בקבוק');

    // Near full bottle
    assert.strictEqual(getSpiritConsumptionGuide(0.9), 'נדרש כמעט בקבוק שלם');

    // Over 1 bottle -> buy an extra bottle
    assert.strictEqual(getSpiritConsumptionGuide(1.2), 'צריכה של מעל בקבוק (מומלץ לקנות בקבוק נוסף)');
  });

  it('calculates slider milestones accurately according to rules', () => {
    const guests: Partial<Guest>[] = [
      ...Array(20).fill({ rsvpStatus: 'coming', isHostingMember: false }),
      ...Array(3).fill({ rsvpStatus: 'coming', isHostingMember: true }),
      ...Array(6).fill({ rsvpStatus: 'maybe', isHostingMember: false }),
      ...Array(4).fill({ rsvpStatus: 'not_coming', isHostingMember: false }),
    ];

    const milestones = calculateSliderMilestones(guests as Guest[]);

    assert.strictEqual(milestones.maxAmount, 33);
    assert.strictEqual(milestones.plausibleMax, 29);
    assert.strictEqual(milestones.expectedAmount, 23);
    assert.strictEqual(milestones.minAmount, 20);
    assert.strictEqual(milestones.averageAmount, 26);
  });

  it('allows overriding keys and recalculating', () => {
    const customKeys = {
      appetizer: 0.1,
      beer_drinker_pct: 0.5
    };
    const computedKeys = calculateKeyRowValues(DEFAULT_KEY_ROWS, customKeys);
    assert.strictEqual(computedKeys['appetizer'], 0.1);
    assert.strictEqual(computedKeys['beer'], 0.75);

    const items = calculateGroceryList(computedKeys, 30);
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    assert.strictEqual(byId['appetizer'].calculatedAmount, 3.0);
    assert.strictEqual(byId['beer'].recommendedPurchase, 23);
  });

  it('identifies constants and formula explanations correctly', () => {
    const wineConstant = DEFAULT_KEY_ROWS.find(r => r.id === 'wine_glasses_per_bottle');
    assert.ok(wineConstant?.isConstant, 'wine_glasses_per_bottle must be a constant');
    assert.strictEqual(wineConstant?.defaultValue, 5);

    const spiritsConstant = DEFAULT_KEY_ROWS.find(r => r.id === 'spirits_shots_per_bottle');
    assert.ok(spiritsConstant?.isConstant, 'spirits_shots_per_bottle must be a constant');
    assert.strictEqual(spiritsConstant?.defaultValue, 16);

    const beerRow = DEFAULT_KEY_ROWS.find(r => r.id === 'beer');
    assert.ok(beerRow?.formulaExplanation && beerRow.formulaExplanation.includes('בירה'));

    const vodkaRow = DEFAULT_KEY_ROWS.find(r => r.id === 'vodka');
    assert.ok(vodkaRow?.formulaExplanation && vodkaRow.formulaExplanation.includes("צ'ייסרים"));
  });

  it('supports getActiveDefaultValue and customDefaults in calculateKeyRowValues', () => {
    const focacciaRow = DEFAULT_KEY_ROWS.find(r => r.id === 'focaccia')!;
    assert.strictEqual(getActiveDefaultValue(focacciaRow, {}), 1 / 6);
    assert.strictEqual(getActiveDefaultValue(focacciaRow, { focaccia: 0.25 }), 0.25);

    // If customDefaults is passed to calculateKeyRowValues:
    const customDefaults = { focaccia: 0.25, beer_drinker_pct: 0.5 };
    const computedWithDefaults = calculateKeyRowValues(DEFAULT_KEY_ROWS, {}, customDefaults);
    assert.strictEqual(computedWithDefaults['focaccia'], 0.25);
    // Beer recalculated: 0.5 * 1.5 = 0.75
    assert.strictEqual(computedWithDefaults['beer'], 0.75);

    // If an override is passed on top of customDefaults:
    const overrides = { focaccia: 0.3 };
    const computedWithBoth = calculateKeyRowValues(DEFAULT_KEY_ROWS, overrides, customDefaults);
    assert.strictEqual(computedWithBoth['focaccia'], 0.3);
  });

  it('parses numeric input and fractions safely', () => {
    assert.strictEqual(parseNumericInput('0.5'), 0.5);
    assert.strictEqual(parseNumericInput('1/6'), 1 / 6);
    assert.strictEqual(parseNumericInput('0.35/3'), 0.35 / 3);
    assert.strictEqual(parseNumericInput('invalid'), null);
  });
});
