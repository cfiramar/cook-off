import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getValidPinsForGuest,
  isGuestPinValid,
  getHouseholdSiblings,
  getLoginHintText
} from './householdPinAuth.ts';
import type { Guest } from '../hooks/useFirebaseData.ts';

describe('householdPinAuth unit tests', () => {
  const guests: Guest[] = [
    {
      id: 'g_1',
      name: 'יוסי כהן',
      pin: '1234',
      status: 'not_logged_in',
      householdId: 'hh_cohen',
      householdName: 'משפחת כהן'
    },
    {
      id: 'g_2',
      name: 'שרה כהן',
      pin: '9876',
      status: 'not_logged_in',
      householdId: 'hh_cohen',
      householdName: 'משפחת כהן'
    },
    {
      id: 'g_3',
      name: 'דניאל לוי',
      pin: '5555',
      status: 'not_logged_in',
      householdId: 'hh_levi',
      householdName: 'משפחת לוי'
    },
    {
      id: 'g_4',
      name: 'אורח יחיד',
      pin: '7777',
      status: 'not_logged_in'
    },
    {
      id: 'g_5',
      name: 'ילד ללא פין',
      pin: '',
      status: 'not_logged_in',
      householdId: 'hh_cohen',
      householdName: 'משפחת כהן'
    }
  ];

  it('allows household members to use each other\'s PIN codes', () => {
    const yossi = guests[0]; // household: hh_cohen, pin: 1234
    const validPinsForYossi = getValidPinsForGuest(yossi, guests);

    assert.ok(validPinsForYossi.has('1234'), 'Yossi should be able to use his own PIN (1234)');
    assert.ok(validPinsForYossi.has('9876'), 'Yossi should be able to use Sarah\'s PIN (9876)');
    assert.strictEqual(validPinsForYossi.has('5555'), false, 'Yossi should not be able to use Levi\'s PIN (5555)');
    assert.strictEqual(validPinsForYossi.has('7777'), false, 'Yossi should not be able to use standalone guest PIN (7777)');

    assert.strictEqual(isGuestPinValid('1234', yossi, guests), true);
    assert.strictEqual(isGuestPinValid('9876', yossi, guests), true);
    assert.strictEqual(isGuestPinValid('0000', yossi, guests), false);
    assert.strictEqual(isGuestPinValid('5555', yossi, guests), false);

    const sarah = guests[1]; // household: hh_cohen, pin: 9876
    assert.strictEqual(isGuestPinValid('1234', sarah, guests), true);
    assert.strictEqual(isGuestPinValid('9876', sarah, guests), true);
  });

  it('allows a household member with no PIN to use any sibling PIN in the household', () => {
    const child = guests[4]; // household: hh_cohen, pin: ''
    const validPinsForChild = getValidPinsForGuest(child, guests);

    assert.ok(validPinsForChild.has('1234'), 'Child should be able to use Yossi\'s PIN');
    assert.ok(validPinsForChild.has('9876'), 'Child should be able to use Sarah\'s PIN');
    assert.strictEqual(isGuestPinValid('1234', child, guests), true);
  });

  it('restricts standalone guests to only their own PIN', () => {
    const solo = guests[3]; // no household
    const validPins = getValidPinsForGuest(solo, guests);

    assert.strictEqual(validPins.size, 1);
    assert.ok(validPins.has('7777'));
    assert.strictEqual(isGuestPinValid('7777', solo, guests), true);
    assert.strictEqual(isGuestPinValid('1234', solo, guests), false);
  });

  it('correctly retrieves household siblings', () => {
    const yossi = guests[0];
    const siblings = getHouseholdSiblings(yossi, guests);

    assert.strictEqual(siblings.length, 2);
    assert.ok(siblings.some(s => s.name === 'שרה כהן'));
    assert.ok(siblings.some(s => s.name === 'ילד ללא פין'));
    assert.strictEqual(siblings.some(s => s.id === yossi.id), false);
  });

  it('generates helpful login hint text depending on household members', () => {
    const yossi = guests[0]; // 2 siblings in household
    const hintYossi = getLoginHintText(yossi, guests);
    assert.ok(hintYossi.includes('בני הבית'), 'Should mention household members when multiple exist');

    const levi = guests[2]; // 0 siblings in hh_levi
    const hintLevi = getLoginHintText(levi, guests);
    assert.strictEqual(hintLevi, '4 ספרות אחרונות של הטלפון');

    // 1 sibling case
    const coupleGuests: Guest[] = [
      { id: 'c_1', name: 'אבי', pin: '1111', status: 'not_logged_in', householdId: 'hh_c' },
      { id: 'c_2', name: 'מיכל', pin: '2222', status: 'not_logged_in', householdId: 'hh_c' }
    ];
    const hintAvi = getLoginHintText(coupleGuests[0], coupleGuests);
    assert.ok(hintAvi.includes('מיכל'), 'Should name the single partner/sibling');
  });

  it('links households by householdName if householdId is missing but names match', () => {
    const customGuests: Guest[] = [
      { id: 'x_1', name: 'רוני', pin: '1122', status: 'not_logged_in', householdName: 'משפחת רון' },
      { id: 'x_2', name: 'מירב', pin: '3344', status: 'not_logged_in', householdName: 'משפחת רון' }
    ];
    assert.strictEqual(isGuestPinValid('3344', customGuests[0], customGuests), true);
    assert.strictEqual(isGuestPinValid('1122', customGuests[1], customGuests), true);
  });
});
