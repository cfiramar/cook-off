/**
 * groceryKeyData.ts
 *
 * Implements the domain logic, data models, and calculations for:
 * 1. The Key table (מפתח כמויות)
 * 2. The Grocery List (רשימת קניות)
 * 3. Guest count slider milestones for event planning
 */

import type { Guest } from '../hooks/useFirebaseData';

export interface KeyRowDefinition {
  id: string;
  category: string;
  item: string;
  defaultValue: number;
  formulaDisplay?: string;
  formulaExplanation?: string;
  isParam?: boolean;
  isCalculated?: boolean;
  isConstant?: boolean;
  unit?: string;
  calculate?: (values: Record<string, number>) => number;
  description?: string;
}

export interface GroceryItem {
  id: string;
  category: string;
  item: string;
  keyId: string;
  keyUsed: number;
  calculatedAmount: number;
  recommendedPurchase: number;
  unit: string;
  isRoundedUp: boolean;
  isFixed?: boolean;
  notes?: string;
  consumptionGuide?: string;
}

export interface SliderMilestones {
  minAmount: number;
  expectedAmount: number;
  averageAmount: number;
  plausibleMax: number;
  maxAmount: number;
  confirmedComingGuests: number;
  confirmedComingHosts: number;
  maybes: number;
  notComing: number;
  totalInvited: number;
}

/**
 * Returns a practical consumption guide for spirits (vodka, tequila, rum)
 * indicating whether 1/4 bottle, 1/2 bottle, 3/4 bottle, or a full bottle is needed.
 */
export function getSpiritConsumptionGuide(bottles: number): string {
  if (bottles <= 0.25) {
    return 'מספיק 1/4 בקבוק';
  }
  if (bottles <= 0.5) {
    return 'מספיק 1/2 בקבוק';
  }
  if (bottles <= 0.75) {
    return 'מספיק 3/4 בקבוק';
  }
  if (bottles <= 1.0) {
    return 'נדרש כמעט בקבוק שלם';
  }
  return 'צריכה של מעל בקבוק (מומלץ לקנות בקבוק נוסף)';
}

/**
 * Formats a grocery unit correctly for Hebrew grammar (e.g. 1 פס, 2 פסים).
 */
export function formatGroceryUnit(unit: string, amount: number): string {
  if (unit === 'פס' || unit === 'פסים') {
    return amount > 1 ? 'פסים' : 'פס';
  }
  return unit;
}

export const DEFAULT_KEY_ROWS: KeyRowDefinition[] = [
  // --- מנות אורחים ---
  {
    id: 'appetizer',
    category: 'מנות אורחים',
    item: 'מתאבן',
    defaultValue: 0.03,
    formulaDisplay: '0.03',
    unit: 'מנות',
    description: 'מפתח מנות מתאבן שמביאים האורחים לכל מוזמן'
  },
  {
    id: 'salad_guest',
    category: 'מנות אורחים',
    item: 'סלט',
    defaultValue: 0.12,
    formulaDisplay: '0.12',
    unit: 'מנות',
    description: 'מפתח מנות סלט שמביאים האורחים לכל מוזמן'
  },
  {
    id: 'main_guest',
    category: 'מנות אורחים',
    item: 'מלוח',
    defaultValue: 0.4,
    formulaDisplay: '0.4',
    unit: 'מנות',
    description: 'מפתח מנות מלוחות/עיקריות שמביאים האורחים לכל מוזמן'
  },
  {
    id: 'dessert_guest',
    category: 'מנות אורחים',
    item: 'קינוח',
    defaultValue: 0.2,
    formulaDisplay: '0.2',
    unit: 'מנות',
    description: 'מפתח מנות קינוח שמביאים האורחים לכל מוזמן'
  },

  // --- מנות שלי ---
  {
    id: 'focaccia',
    category: 'מנות שלי',
    item: "פוקאצה (יח')",
    defaultValue: 1 / 6,
    formulaDisplay: '1/6',
    formulaExplanation: 'פוקאצה 1 לכל 6 מוזמנים (1/6)',
    unit: "יח'",
    description: 'פוקאצה אחת לכל 6 מוזמנים'
  },
  {
    id: 'quiche',
    category: 'מנות שלי',
    item: 'פשטידה (תבנית)',
    defaultValue: 1 / 12,
    formulaDisplay: '1/12',
    formulaExplanation: 'תבנית פשטידה 1 לכל 12 מוזמנים (1/12)',
    unit: 'תבנית',
    description: 'תבנית פשטידה אחת לכל 12 מוזמנים'
  },
  {
    id: 'mini_pizza',
    category: 'מנות שלי',
    item: "פיצות קטנות (יח')",
    defaultValue: 1.75,
    formulaDisplay: '1.75',
    unit: "יח'",
    description: '1.75 פיצות אישיות לכל מוזמן (מעוגל כלפי מעלה)'
  },
  {
    id: 'salad_meal',
    category: 'מנות שלי',
    item: 'סלט (קערה)',
    defaultValue: 1 / 8,
    formulaDisplay: '1/8',
    formulaExplanation: 'קערת סלט גדולה 1 לכל 8 מוזמנים (1/8)',
    unit: 'קערה',
    description: 'קערת סלט גדולה אחת לכל 8 מוזמנים'
  },

  // --- קינוחים שלי ---
  {
    id: 'cake',
    category: 'קינוחים שלי',
    item: 'עוגה (פס)',
    defaultValue: 1 / 10,
    formulaDisplay: '1/10',
    formulaExplanation: 'פס עוגה 1 לכל 10 מוזמנים (1/10)',
    unit: 'פס',
    description: 'פס עוגה אחד לכל 10 מוזמנים'
  },
  {
    id: 'choco_balls',
    category: 'קינוחים שלי',
    item: "כדורי שוקולד (יח')",
    defaultValue: 2.5,
    formulaDisplay: '2.5',
    unit: "יח'",
    description: '2.5 כדורי שוקולד לכל מוזמן (מעוגל כלפי מעלה)'
  },

  // --- ירקות ---
  {
    id: 'cucumber',
    category: 'ירקות',
    item: "מלפפון (יח')",
    defaultValue: 0.35 / 3,
    formulaDisplay: '0.35/3',
    formulaExplanation: '0.35 ק"ג מלפפונים חלקי 3 למוזמן',
    unit: "יח'",
    description: '0.35 ק"ג מלפפונים חלקי 3 לכל מוזמן'
  },
  {
    id: 'carrot',
    category: 'ירקות',
    item: "גזר (יח')",
    defaultValue: 0.35 / 3,
    formulaDisplay: '0.35/3',
    formulaExplanation: '0.35 ק"ג גזר חלקי 3 למוזמן',
    unit: "יח'",
    description: '0.35 ק"ג גזר חלקי 3 לכל מוזמן'
  },
  {
    id: 'pepper',
    category: 'ירקות',
    item: "גמבה (יח')",
    defaultValue: 0.3 / 3,
    formulaDisplay: '0.3/3',
    formulaExplanation: '0.3 ק"ג גמבה חלקי 3 למוזמן',
    unit: "יח'",
    description: '0.3 ק"ג גמבה חלקי 3 לכל מוזמן'
  },
  {
    id: 'cherry_tomatoes',
    category: 'ירקות',
    item: "עגבניות שרי (יח')",
    defaultValue: 1.5,
    formulaDisplay: '1.5',
    unit: "יח'",
    description: '1.5 עגבניות שרי לכל מוזמן'
  },

  // --- חטיפים ---
  {
    id: 'bamba',
    category: 'חטיפים',
    item: 'במבה (שקיות גדולות)',
    defaultValue: 0.13,
    formulaDisplay: '0.13',
    unit: 'שקיות',
    description: '0.13 שקיות במבה גדולות לכל מוזמן'
  },
  {
    id: 'bissli',
    category: 'חטיפים',
    item: 'ביסלי (שקיות גדולות)',
    defaultValue: 0.13,
    formulaDisplay: '0.13',
    unit: 'שקיות',
    description: '0.13 שקיות ביסלי גדולות לכל מוזמן'
  },
  {
    id: 'chips',
    category: 'חטיפים',
    item: 'תפוצ’יפס (שקיות גדולות)',
    defaultValue: 0.13,
    formulaDisplay: '0.13',
    unit: 'שקיות',
    description: '0.13 שקיות תפוצ’יפס גדולות לכל מוזמן'
  },

  // --- שתייה חריפה ---
  {
    id: 'beer_drinker_pct',
    category: 'שתייה חריפה',
    item: 'אחוז השותים בירה',
    defaultValue: 0.8,
    formulaDisplay: '0.8',
    isParam: true,
    unit: '%',
    description: 'שיעור האורחים השותים בירה (80%)'
  },
  {
    id: 'beer_bottles_per_person',
    category: 'שתייה חריפה',
    item: 'בקבוקים לאדם (לשותה בירה)',
    defaultValue: 1.5,
    formulaDisplay: '1.5',
    isParam: true,
    unit: 'בקבוקים',
    description: 'כמות בקבוקי בירה לאדם השותה בירה'
  },
  {
    id: 'beer',
    category: 'שתייה חריפה',
    item: 'בירות (בקבוקים)',
    defaultValue: 1.2,
    formulaDisplay: 'C19 * C20',
    formulaExplanation: 'מחושב: % שותי בירה × בקבוקים לאדם',
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => (v['beer_drinker_pct'] ?? 0.8) * (v['beer_bottles_per_person'] ?? 1.5),
    description: 'מפתח בקבוקי בירה למוזמן (אחוז שותים × בקבוקים לאדם)'
  },
  {
    id: 'wine_drinker_pct',
    category: 'שתייה חריפה',
    item: 'אחוז השותים יין',
    defaultValue: 0.2,
    formulaDisplay: '0.2',
    isParam: true,
    unit: '%',
    description: 'שיעור האורחים השותים יין (20%)'
  },
  {
    id: 'wine_glasses_per_person',
    category: 'שתייה חריפה',
    item: 'כוסות לאדם (לשותה יין)',
    defaultValue: 1.5,
    formulaDisplay: '1.5',
    isParam: true,
    unit: 'כוסות',
    description: 'כמות כוסות יין לשותה יין'
  },
  {
    id: 'wine_glasses_per_bottle',
    category: 'שתייה חריפה',
    item: 'כוסות בבקבוק יין',
    defaultValue: 5,
    formulaDisplay: '5',
    formulaExplanation: 'קבוע המרה: 5 כוסות בבקבוק יין (750 מ"ל)',
    isParam: true,
    isConstant: true,
    unit: 'כוסות/בקבוק',
    description: 'מספר כוסות יין בבקבוק יין סטנדרטי (750 מ"ל)'
  },
  {
    id: 'wine',
    category: 'שתייה חריפה',
    item: 'יין (בקבוקים)',
    defaultValue: 0.06,
    formulaDisplay: 'C22 * (C23 / C24)',
    formulaExplanation: 'מחושב: % שותי יין × (כוסות לאדם ÷ 5 כוסות לבקבוק)',
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const pct = v['wine_drinker_pct'] ?? 0.2;
      const glasses = v['wine_glasses_per_person'] ?? 1.5;
      const perBottle = v['wine_glasses_per_bottle'] || 5;
      return pct * (glasses / perBottle);
    },
    description: 'מפתח בקבוקי יין למוזמן'
  },
  {
    id: 'spirits_drinker_pct',
    category: 'שתייה חריפה',
    item: 'אחוז השותים אלכוהול כבד',
    defaultValue: 0.1,
    formulaDisplay: '0.1',
    isParam: true,
    unit: '%',
    description: 'שיעור האורחים השותים אלכוהול כבד (וודקה, טקילה ורום - כ-10%)'
  },
  {
    id: 'spirits_shots_per_drinker',
    category: 'שתייה חריפה',
    item: "צ'ייסרים לאדם",
    defaultValue: 1.25,
    formulaDisplay: '1.25',
    isParam: true,
    unit: "צ'ייסרים",
    description: "כ-1.25 צ'ייסרים לכל אדם השותה אלכוהול כבד"
  },
  {
    id: 'spirits_shots_per_bottle',
    category: 'שתייה חריפה',
    item: "צ'ייסרים לבקבוק אלכוהול",
    defaultValue: 16,
    formulaDisplay: '16',
    formulaExplanation: 'קבוע המרה: 16 צ\'ייסרים בבקבוק 750 מ"ל',
    isParam: true,
    isConstant: true,
    unit: "צ'ייסרים/בקבוק",
    description: "מספר צ'ייסרים תקניים בבקבוק 750 מ\"ל"
  },
  {
    id: 'vodka',
    category: 'שתייה חריפה',
    item: 'וודקה (בקבוקים)',
    defaultValue: (0.1 * 1.25) / 16,
    formulaDisplay: '(0.1 * 1.25) / 16',
    formulaExplanation: "מחושב: (% שותים × צ'ייסרים לאדם) ÷ 16 צ'ייסרים לבקבוק",
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const pct = v['spirits_drinker_pct'] ?? 0.1;
      const shots = v['spirits_shots_per_drinker'] ?? 1.25;
      const perBottle = v['spirits_shots_per_bottle'] || 16;
      return (pct * shots) / perBottle;
    },
    description: 'צריכת וודקה צפויה למוזמן. תמיד מומלץ שיהיה לפחות בקבוק אחד באירוע.'
  },
  {
    id: 'tequila',
    category: 'שתייה חריפה',
    item: 'טקילה (בקבוקים)',
    defaultValue: (0.05 * 1.25) / 16,
    formulaDisplay: '(0.05 * 1.25) / 16',
    formulaExplanation: "מחושב: (50% משותי אלכוהול כבד × צ'ייסרים) ÷ 16 לבקבוק",
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const pct = (v['spirits_drinker_pct'] ?? 0.1) * 0.5;
      const shots = v['spirits_shots_per_drinker'] ?? 1.25;
      const perBottle = v['spirits_shots_per_bottle'] || 16;
      return (pct * shots) / perBottle;
    },
    description: 'צריכת טקילה צפויה למוזמן (העדפה משנית בצ\'ייסרים).'
  },
  {
    id: 'rum',
    category: 'שתייה חריפה',
    item: 'רום (בקבוקים)',
    defaultValue: (0.03 * 1.25) / 16,
    formulaDisplay: '(0.03 * 1.25) / 16',
    formulaExplanation: "מחושב: (30% משותי אלכוהול כבד × צ'ייסרים) ÷ 16 לבקבוק",
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const pct = (v['spirits_drinker_pct'] ?? 0.1) * 0.3;
      const shots = v['spirits_shots_per_drinker'] ?? 1.25;
      const perBottle = v['spirits_shots_per_bottle'] || 16;
      return (pct * shots) / perBottle;
    },
    description: 'צריכת רום צפויה למוזמן (לקוקטיילים או צ\'ייסרים).'
  },

  // --- שתייה קלה ---
  {
    id: 'soft_drinks_glasses_per_person',
    category: 'שתייה קלה',
    item: 'כוסות שתייה קלה לאדם',
    defaultValue: 2,
    formulaDisplay: '2',
    isParam: true,
    unit: 'כוסות',
    description: 'כמות כוסות שתייה קלה ממוצעת למוזמן'
  },
  {
    id: 'soft_drinks_bottles_per_person',
    category: 'שתייה קלה',
    item: 'סך בקבוקי שתייה קלה לאדם',
    defaultValue: 0.32,
    formulaDisplay: '(C29 * 0.24) / 1.5',
    formulaExplanation: 'מחושב: (כוסות לאדם × 0.24 ל\' לכוס) ÷ 1.5 ל\' לבקבוק',
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const glasses = v['soft_drinks_glasses_per_person'] ?? 2;
      return (glasses * 0.24) / 1.5;
    },
    description: 'סך בקבוקי שתייה קלה (1.5 ליטר) הנדרשים למוזמן'
  },
  {
    id: 'coke',
    category: 'שתייה קלה',
    item: 'קולה (בקבוקים)',
    defaultValue: 0.32 * (1 / 3),
    formulaDisplay: 'C30 * 1/3',
    formulaExplanation: 'מחושב: 1/3 מסך בקבוקי השתייה הקלה',
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const base = v['soft_drinks_bottles_per_person'] ?? 0.32;
      return base * (1 / 3);
    },
    description: 'שליש מסך השתייה הקלה'
  },
  {
    id: 'sprite',
    category: 'שתייה קלה',
    item: 'ספרייט (בקבוקים)',
    defaultValue: 0.32 * (1 / 3),
    formulaDisplay: 'C30 * 1/3',
    formulaExplanation: 'מחושב: 1/3 מסך בקבוקי השתייה הקלה',
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const base = v['soft_drinks_bottles_per_person'] ?? 0.32;
      return base * (1 / 3);
    },
    description: 'שליש מסך השתייה הקלה'
  },
  {
    id: 'juice_orange',
    category: 'שתייה קלה',
    item: 'מיץ תפוזים (בקבוקים)',
    defaultValue: 0.32 * (1 / 6),
    formulaDisplay: 'C30 * 1/6',
    formulaExplanation: 'מחושב: 1/6 מסך בקבוקי השתייה הקלה',
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const base = v['soft_drinks_bottles_per_person'] ?? 0.32;
      return base * (1 / 6);
    },
    description: 'שישית מסך השתייה הקלה'
  },
  {
    id: 'juice_fuze_tea',
    category: 'שתייה קלה',
    item: 'פיוזטי (בקבוקים)',
    defaultValue: 0.32 * (1 / 6),
    formulaDisplay: 'C30 * 1/6',
    formulaExplanation: 'מחושב: 1/6 מסך בקבוקי השתייה הקלה',
    isCalculated: true,
    unit: 'בקבוקים',
    calculate: (v) => {
      const base = v['soft_drinks_bottles_per_person'] ?? 0.32;
      return base * (1 / 6);
    },
    description: 'שישית מסך השתייה הקלה'
  }
];

/**
 * Retrieves the active default value for a row definition, checking
 * if a customized default exists in customDefaults, otherwise falling back
 * to row.defaultValue.
 */
export function getActiveDefaultValue(
  row: KeyRowDefinition,
  customDefaults?: Record<string, number>
): number {
  if (customDefaults && customDefaults[row.id] !== undefined && !isNaN(customDefaults[row.id])) {
    return customDefaults[row.id];
  }
  return row.defaultValue;
}

/**
 * Computes all active key values, evaluating formulas or accepting user overrides.
 *
 * @param definitions Array of key row definitions
 * @param overrides User-edited key overrides
 * @param customDefaults System-wide customized defaults (saved via 'Set as new Defaults')
 * @returns Map of key id to numerical key value
 */
export function calculateKeyRowValues(
  definitions: KeyRowDefinition[],
  overrides: Record<string, number> = {},
  customDefaults?: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};

  // First pass: non-calculated rows or overridden calculated rows
  for (const def of definitions) {
    if (overrides[def.id] !== undefined && !isNaN(overrides[def.id])) {
      result[def.id] = overrides[def.id];
    } else if (customDefaults && customDefaults[def.id] !== undefined && !isNaN(customDefaults[def.id])) {
      result[def.id] = customDefaults[def.id];
    } else if (!def.isCalculated) {
      result[def.id] = def.defaultValue;
    }
  }

  // Second pass: calculated rows that are not explicitly overridden
  for (const def of definitions) {
    if (def.isCalculated && overrides[def.id] === undefined) {
      if (def.calculate) {
        result[def.id] = def.calculate(result);
      } else if (customDefaults && customDefaults[def.id] !== undefined && !isNaN(customDefaults[def.id])) {
        result[def.id] = customDefaults[def.id];
      } else {
        result[def.id] = def.defaultValue;
      }
    }
  }

  return result;
}

/**
 * Parses user input for keys, supporting decimals (0.5), fractions (1/6), and ratios (0.35/3).
 */
export function parseNumericInput(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^=/, '');
  if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  const fractionMatch = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (den !== 0) {
      return num / den;
    }
  }
  return null;
}

/**
 * Generates the full 26-item grocery list calculated for N guests.
 *
 * @param keys The computed key mapping
 * @param guestCount Multiplier N
 */
export function calculateGroceryList(
  keys: Record<string, number>,
  guestCount: number
): GroceryItem[] {
  const N = Math.max(0, guestCount);

  // Spirits calculations: always ensure at least 1 bottle in recommended purchase
  const defaultVodkaKey = (0.1 * 1.25) / 16;
  const defaultTequilaKey = (0.05 * 1.25) / 16;
  const defaultRumKey = (0.03 * 1.25) / 16;

  const vodkaKey = keys['vodka'] ?? defaultVodkaKey;
  const tequilaKey = keys['tequila'] ?? defaultTequilaKey;
  const rumKey = keys['rum'] ?? defaultRumKey;

  const vodkaCalculated = vodkaKey * N;
  const tequilaCalculated = tequilaKey * N;
  const rumCalculated = rumKey * N;

  return [
    // 1. מנות אורחים
    {
      id: 'appetizer',
      category: 'מנות אורחים',
      item: 'מתאבן',
      keyId: 'appetizer',
      keyUsed: keys['appetizer'] ?? 0.03,
      calculatedAmount: (keys['appetizer'] ?? 0.03) * N,
      recommendedPurchase: Math.ceil((keys['appetizer'] ?? 0.03) * N),
      unit: 'מנות',
      isRoundedUp: false
    },
    {
      id: 'salad_guest',
      category: 'מנות אורחים',
      item: 'סלט (כולל ירקות חתוכים)',
      keyId: 'salad_guest',
      keyUsed: keys['salad_guest'] ?? 0.12,
      calculatedAmount: (keys['salad_guest'] ?? 0.12) * N,
      recommendedPurchase: Math.ceil((keys['salad_guest'] ?? 0.12) * N),
      unit: 'מנות',
      isRoundedUp: false
    },
    {
      id: 'main_guest',
      category: 'מנות אורחים',
      item: 'מלוח',
      keyId: 'main_guest',
      keyUsed: keys['main_guest'] ?? 0.4,
      calculatedAmount: (keys['main_guest'] ?? 0.4) * N,
      recommendedPurchase: Math.ceil((keys['main_guest'] ?? 0.4) * N),
      unit: 'מנות',
      isRoundedUp: false
    },
    {
      id: 'dessert_guest',
      category: 'מנות אורחים',
      item: 'קינוח',
      keyId: 'dessert_guest',
      keyUsed: keys['dessert_guest'] ?? 0.2,
      calculatedAmount: (keys['dessert_guest'] ?? 0.2) * N,
      recommendedPurchase: Math.ceil((keys['dessert_guest'] ?? 0.2) * N),
      unit: 'מנות',
      isRoundedUp: false
    },

    // 2. מנות שלי
    {
      id: 'focaccia',
      category: 'מנות שלי',
      item: "פוקאצה (יח')",
      keyId: 'focaccia',
      keyUsed: keys['focaccia'] ?? (1 / 6),
      calculatedAmount: (keys['focaccia'] ?? (1 / 6)) * N,
      recommendedPurchase: Math.ceil((keys['focaccia'] ?? (1 / 6)) * N),
      unit: "יח'",
      isRoundedUp: false
    },
    {
      id: 'quiche',
      category: 'מנות שלי',
      item: 'פשטידה (תבנית)',
      keyId: 'quiche',
      keyUsed: keys['quiche'] ?? (1 / 12),
      calculatedAmount: (keys['quiche'] ?? (1 / 12)) * N,
      recommendedPurchase: Math.ceil((keys['quiche'] ?? (1 / 12)) * N),
      unit: 'תבנית',
      isRoundedUp: false
    },
    {
      id: 'mini_pizza',
      category: 'מנות שלי',
      item: "פיצות קטנות (יח')",
      keyId: 'mini_pizza',
      keyUsed: keys['mini_pizza'] ?? 1.75,
      calculatedAmount: (keys['mini_pizza'] ?? 1.75) * N,
      recommendedPurchase: Math.ceil((keys['mini_pizza'] ?? 1.75) * N),
      unit: "יח'",
      isRoundedUp: true
    },
    {
      id: 'salad_meal',
      category: 'מנות שלי',
      item: 'סלט (קערה)',
      keyId: 'salad_meal',
      keyUsed: keys['salad_meal'] ?? (1 / 8),
      calculatedAmount: (keys['salad_meal'] ?? (1 / 8)) * N,
      recommendedPurchase: Math.ceil((keys['salad_meal'] ?? (1 / 8)) * N),
      unit: 'קערה',
      isRoundedUp: false
    },

    // 3. קינוחים שלי
    {
      id: 'cake',
      category: 'קינוחים שלי',
      item: 'עוגה (פס)',
      keyId: 'cake',
      keyUsed: keys['cake'] ?? (1 / 10),
      calculatedAmount: (keys['cake'] ?? (1 / 10)) * N,
      recommendedPurchase: Math.ceil((keys['cake'] ?? (1 / 10)) * N),
      unit: Math.ceil((keys['cake'] ?? (1 / 10)) * N) > 1 ? 'פסים' : 'פס',
      isRoundedUp: false
    },
    {
      id: 'choco_balls',
      category: 'קינוחים שלי',
      item: "כדורי שוקולד (יח')",
      keyId: 'choco_balls',
      keyUsed: keys['choco_balls'] ?? 2.5,
      calculatedAmount: (keys['choco_balls'] ?? 2.5) * N,
      recommendedPurchase: Math.ceil((keys['choco_balls'] ?? 2.5) * N),
      unit: "יח'",
      isRoundedUp: true
    },

    // 4. ירקות
    {
      id: 'cucumber',
      category: 'ירקות',
      item: "מלפפון (יח')",
      keyId: 'cucumber',
      keyUsed: keys['cucumber'] ?? (0.35 / 3),
      calculatedAmount: (keys['cucumber'] ?? (0.35 / 3)) * N,
      recommendedPurchase: Math.ceil((keys['cucumber'] ?? (0.35 / 3)) * N),
      unit: "יח'",
      isRoundedUp: false
    },
    {
      id: 'carrot',
      category: 'ירקות',
      item: "גזר (יח')",
      keyId: 'carrot',
      keyUsed: keys['carrot'] ?? (0.35 / 3),
      calculatedAmount: (keys['carrot'] ?? (0.35 / 3)) * N,
      recommendedPurchase: Math.ceil((keys['carrot'] ?? (0.35 / 3)) * N),
      unit: "יח'",
      isRoundedUp: false
    },
    {
      id: 'pepper',
      category: 'ירקות',
      item: "גמבה (יח')",
      keyId: 'pepper',
      keyUsed: keys['pepper'] ?? (0.3 / 3),
      calculatedAmount: (keys['pepper'] ?? (0.3 / 3)) * N,
      recommendedPurchase: Math.ceil((keys['pepper'] ?? (0.3 / 3)) * N),
      unit: "יח'",
      isRoundedUp: false
    },
    {
      id: 'cherry_tomatoes',
      category: 'ירקות',
      item: "עגבניות שרי (יח')",
      keyId: 'cherry_tomatoes',
      keyUsed: keys['cherry_tomatoes'] ?? 1.5,
      calculatedAmount: (keys['cherry_tomatoes'] ?? 1.5) * N,
      recommendedPurchase: Math.ceil((keys['cherry_tomatoes'] ?? 1.5) * N),
      unit: "יח'",
      isRoundedUp: false
    },

    // 5. חטיפים
    {
      id: 'bamba',
      category: 'חטיפים',
      item: 'במבה (שקיות גדולות)',
      keyId: 'bamba',
      keyUsed: keys['bamba'] ?? 0.13,
      calculatedAmount: (keys['bamba'] ?? 0.13) * N,
      recommendedPurchase: Math.ceil((keys['bamba'] ?? 0.13) * N),
      unit: 'שקיות',
      isRoundedUp: false
    },
    {
      id: 'bissli',
      category: 'חטיפים',
      item: 'ביסלי (שקיות גדולות)',
      keyId: 'bissli',
      keyUsed: keys['bissli'] ?? 0.13,
      calculatedAmount: (keys['bissli'] ?? 0.13) * N,
      recommendedPurchase: Math.ceil((keys['bissli'] ?? 0.13) * N),
      unit: 'שקיות',
      isRoundedUp: false
    },
    {
      id: 'chips',
      category: 'חטיפים',
      item: 'תפוצ’יפס (שקיות גדולות)',
      keyId: 'chips',
      keyUsed: keys['chips'] ?? 0.13,
      calculatedAmount: (keys['chips'] ?? 0.13) * N,
      recommendedPurchase: Math.ceil((keys['chips'] ?? 0.13) * N),
      unit: 'שקיות',
      isRoundedUp: false
    },

    // 6. שתייה חריפה
    {
      id: 'beer',
      category: 'שתייה חריפה',
      item: "בירות (יח')",
      keyId: 'beer',
      keyUsed: keys['beer'] ?? 1.2,
      calculatedAmount: (keys['beer'] ?? 1.2) * N,
      recommendedPurchase: Math.ceil((keys['beer'] ?? 1.2) * N),
      unit: 'בקבוקים',
      isRoundedUp: true
    },
    {
      id: 'wine',
      category: 'שתייה חריפה',
      item: 'יין',
      keyId: 'wine',
      keyUsed: keys['wine'] ?? 0.06,
      calculatedAmount: (keys['wine'] ?? 0.06) * N,
      recommendedPurchase: Math.ceil((keys['wine'] ?? 0.06) * N),
      unit: 'בקבוקים',
      isRoundedUp: false
    },
    {
      id: 'vodka',
      category: 'שתייה חריפה',
      item: 'וודקה',
      keyId: 'vodka',
      keyUsed: vodkaKey,
      calculatedAmount: vodkaCalculated,
      recommendedPurchase: Math.max(1, Math.ceil(vodkaCalculated)),
      unit: 'בקבוקים',
      isRoundedUp: true,
      isFixed: false,
      consumptionGuide: getSpiritConsumptionGuide(vodkaCalculated)
    },
    {
      id: 'tequila',
      category: 'שתייה חריפה',
      item: 'טקילה',
      keyId: 'tequila',
      keyUsed: tequilaKey,
      calculatedAmount: tequilaCalculated,
      recommendedPurchase: Math.max(1, Math.ceil(tequilaCalculated)),
      unit: 'בקבוקים',
      isRoundedUp: true,
      isFixed: false,
      consumptionGuide: getSpiritConsumptionGuide(tequilaCalculated)
    },
    {
      id: 'rum',
      category: 'שתייה חריפה',
      item: 'רום',
      keyId: 'rum',
      keyUsed: rumKey,
      calculatedAmount: rumCalculated,
      recommendedPurchase: Math.max(1, Math.ceil(rumCalculated)),
      unit: 'בקבוקים',
      isRoundedUp: true,
      isFixed: false,
      consumptionGuide: getSpiritConsumptionGuide(rumCalculated)
    },

    // 7. שתייה קלה
    {
      id: 'coke',
      category: 'שתייה קלה',
      item: "קולה (יח')",
      keyId: 'coke',
      keyUsed: keys['coke'] ?? (0.32 / 3),
      calculatedAmount: (keys['coke'] ?? (0.32 / 3)) * N,
      recommendedPurchase: Math.ceil((keys['coke'] ?? (0.32 / 3)) * N),
      unit: 'בקבוקים',
      isRoundedUp: false
    },
    {
      id: 'sprite',
      category: 'שתייה קלה',
      item: "ספרייט (יח')",
      keyId: 'sprite',
      keyUsed: keys['sprite'] ?? (0.32 / 3),
      calculatedAmount: (keys['sprite'] ?? (0.32 / 3)) * N,
      recommendedPurchase: Math.ceil((keys['sprite'] ?? (0.32 / 3)) * N),
      unit: 'בקבוקים',
      isRoundedUp: false
    },
    {
      id: 'juice_orange',
      category: 'שתייה קלה',
      item: "מיץ תפוזים (יח')",
      keyId: 'juice_orange',
      keyUsed: keys['juice_orange'] ?? (0.32 / 6),
      calculatedAmount: (keys['juice_orange'] ?? (0.32 / 6)) * N,
      recommendedPurchase: Math.ceil((keys['juice_orange'] ?? (0.32 / 6)) * N),
      unit: 'בקבוקים',
      isRoundedUp: false
    },
    {
      id: 'juice_fuze_tea',
      category: 'שתייה קלה',
      item: "פיוזטי (יח')",
      keyId: 'juice_fuze_tea',
      keyUsed: keys['juice_fuze_tea'] ?? (0.32 / 6),
      calculatedAmount: (keys['juice_fuze_tea'] ?? (0.32 / 6)) * N,
      recommendedPurchase: Math.ceil((keys['juice_fuze_tea'] ?? (0.32 / 6)) * N),
      unit: 'בקבוקים',
      isRoundedUp: false
    }
  ];
}

/**
 * Calculates the guest slider milestones:
 * - max-amount: all guests invited
 * - plausible-max: all coming guests + coming hosts + maybes
 * - expected-amount: just confirmed coming guests and hosts
 * - min-amount: 0.9 * expected-amount
 * - average: (plausible-max + expected-amount) / 2
 *
 * @param guests Event guests array (including hosts)
 */
export function calculateSliderMilestones(guests: Guest[] = []): SliderMilestones {
  const totalInvited = guests.length;

  let confirmedComingGuests = 0;
  let confirmedComingHosts = 0;
  let maybes = 0;
  let notComing = 0;

  for (const g of guests) {
    if (g.rsvpStatus === 'coming') {
      if (g.isHostingMember) {
        confirmedComingHosts++;
      } else {
        confirmedComingGuests++;
      }
    } else if (g.rsvpStatus === 'maybe' || (!g.rsvpStatus && !g.isHostingMember)) {
      maybes++;
    } else if (g.rsvpStatus === 'not_coming') {
      notComing++;
    }
  }

  // 1. Expected-amount: confirmed coming guests and hosts
  const expectedAmount = confirmedComingGuests + confirmedComingHosts;

  // 2. Plausible-max: all coming guests + coming hosts + maybes
  const plausibleMax = expectedAmount + maybes;

  // 3. Max-amount: all guests invited
  const maxAmount = totalInvited;

  // 4. Min-amount: 0.9 * expected-amount rounded down to integer
  const minAmount = Math.floor(expectedAmount * 0.9);

  // 5. Average step between plausible-max and expected-amount
  const averageAmount = Number(((plausibleMax + expectedAmount) / 2).toFixed(1));

  return {
    minAmount,
    expectedAmount,
    averageAmount,
    plausibleMax,
    maxAmount,
    confirmedComingGuests,
    confirmedComingHosts,
    maybes,
    notComing,
    totalInvited
  };
}
