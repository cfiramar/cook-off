import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isHebrewText, getTextDirection, getTitleFontFamily } from './textUtils.ts';

describe('textUtils unit tests', () => {
  describe('isHebrewText', () => {
    it('returns true when text contains Hebrew characters', () => {
      assert.strictEqual(isHebrewText('שלום עולם'), true);
      assert.strictEqual(isHebrewText('חטא מתוק בחצות'), true);
      assert.strictEqual(isHebrewText('Pizza פטריות'), true);
    });

    it('returns false for pure English or empty text', () => {
      assert.strictEqual(isHebrewText('Spooky Burger'), false);
      assert.strictEqual(isHebrewText(''), false);
      assert.strictEqual(isHebrewText(undefined), false);
      assert.strictEqual(isHebrewText('12345 !?'), false);
    });
  });

  describe('getTextDirection', () => {
    it('returns ltr when text is mostly in English', () => {
      assert.strictEqual(getTextDirection('Delicious Apple Pie'), 'ltr');
      assert.strictEqual(getTextDirection('Chef Gordon Ramsay'), 'ltr');
      // Mostly English with minor Hebrew reference
      assert.strictEqual(getTextDirection('Spooky Pasta with a touch of רוטב'), 'ltr');
    });

    it('returns rtl when text is mostly in Hebrew', () => {
      assert.strictEqual(getTextDirection('עוגת שוקולד עסיסית'), 'rtl');
      assert.strictEqual(getTextDirection('פאי תפוחים עם גלידת Vanilla'), 'rtl');
    });

    it('defaults to rtl for empty or non-alphabetic text', () => {
      assert.strictEqual(getTextDirection(''), 'rtl');
      assert.strictEqual(getTextDirection(undefined), 'rtl');
      assert.strictEqual(getTextDirection('12345'), 'rtl');
    });
  });

  describe('getTitleFontFamily', () => {
    it('returns Rubik Wet Paint for Hebrew titles', () => {
      assert.strictEqual(getTitleFontFamily('חטא מתוק בחצות'), "'Rubik Wet Paint', sans-serif");
      assert.strictEqual(getTitleFontFamily('המנה המורעלת'), "'Rubik Wet Paint', sans-serif");
    });

    it('returns var(--theme-font) for English or other non-Hebrew titles', () => {
      assert.strictEqual(getTitleFontFamily('Midnight Poison Cake'), 'var(--theme-font)');
      assert.strictEqual(getTitleFontFamily(''), 'var(--theme-font)');
    });
  });
});
