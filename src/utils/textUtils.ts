/**
 * @file textUtils.ts
 * @description Utility functions for text language detection, script direction (LTR/RTL),
 * and dynamic styling for multilingual display in View Mode.
 */

/**
 * Checks whether a given string contains any Hebrew characters.
 *
 * @param text The input string to test
 * @returns True if Hebrew characters (\u0590-\u05FF) are present
 */
export function isHebrewText(text?: string): boolean {
  if (!text) return false;
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Determines whether text should be displayed in LTR or RTL direction.
 * As per specification: Text fields that are mostly in English should be LTR (titles, descriptions, names, etc.).
 *
 * @param text The input string to evaluate
 * @returns 'ltr' if Latin characters outnumber Hebrew/Arabic characters, otherwise 'rtl'
 */
export function getTextDirection(text?: string): 'ltr' | 'rtl' {
  if (!text) return 'rtl';

  const hebrewOrArabicMatches = text.match(/[\u0590-\u05FF\u0600-\u06FF]/g) || [];
  const latinMatches = text.match(/[a-zA-Z]/g) || [];

  if (latinMatches.length > hebrewOrArabicMatches.length) {
    return 'ltr';
  }

  return 'rtl';
}

/**
 * Returns the appropriate font-family for a title string.
 * Uses "Rubik Wet Paint" for Hebrew titles, and falls back to the active theme font for others.
 *
 * @param text The title text
 * @returns CSS font-family string
 */
export function getTitleFontFamily(text?: string): string {
  if (isHebrewText(text)) {
    return "'Rubik Wet Paint', sans-serif";
  }
  return 'var(--theme-font)';
}
