import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNonComingHouseholdIds,
  buildHouseholdSections,
  type MinimalGuest,
  type MinimalHouseholdGroup
} from './guestSortingGrouping.ts';

describe('getNonComingHouseholdIds', () => {
  it('correctly identifies households where all members are not coming', () => {
    const guests: MinimalGuest[] = [
      { id: '1', name: 'Alice', householdId: 'h1', rsvpStatus: 'not_coming' },
      { id: '2', name: 'Bob', householdId: 'h1', rsvpStatus: 'not_coming' },
      { id: '3', name: 'Charlie', householdId: 'h2', rsvpStatus: 'coming' },
      { id: '4', name: 'Dana', householdId: 'h2', rsvpStatus: 'not_coming' },
      { id: '5', name: 'Eve', householdId: 'h3', rsvpStatus: 'maybe' },
      { id: '6', name: 'Solo', rsvpStatus: 'not_coming' },
    ];

    const result = getNonComingHouseholdIds(guests);
    assert.equal(result.has('h1'), true);
    assert.equal(result.has('h2'), false); // Dana is not coming, but Charlie is coming!
    assert.equal(result.has('h3'), false); // Eve is maybe
    assert.equal(result.has('ind_6'), true); // Solo guest is not coming
  });
});

describe('buildHouseholdSections', () => {
  const dummyHouseholds: MinimalHouseholdGroup[] = [
    {
      id: 'h1',
      name: 'משפחת לוי',
      members: [{}, {}],
      allNotComing: false,
      hasComing: true,
      paidCount: 2,
      comingCount: 2,
      comingPaidCount: 2,
      hasPaidNotComingAlert: false,
      labels: []
    },
    {
      id: 'h2',
      name: 'משפחת כהן',
      members: [{}, {}],
      allNotComing: false,
      hasComing: true,
      paidCount: 1,
      comingCount: 2,
      comingPaidCount: 1,
      hasPaidNotComingAlert: false,
      labels: []
    },
    {
      id: 'h3',
      name: 'משפחת אברהם',
      members: [{}],
      allNotComing: false,
      hasComing: false,
      paidCount: 0,
      comingCount: 0,
      comingPaidCount: 0,
      hasPaidNotComingAlert: false,
      labels: []
    },
    {
      id: 'h4',
      name: 'משפחת דוד',
      members: [{}],
      allNotComing: true,
      hasComing: false,
      paidCount: 0,
      comingCount: 0,
      comingPaidCount: 0,
      hasPaidNotComingAlert: false,
      labels: []
    }
  ];

  it('name sort returns a single section with no title', () => {
    const sections = buildHouseholdSections('name', dummyHouseholds);
    assert.equal(sections.length, 1);
    assert.equal(sections[0].title, undefined);
    assert.equal(sections[0].households.length, 4);
  });

  it('arrival sort groups by coming, maybe, and not_coming', () => {
    const sections = buildHouseholdSections('arrival', dummyHouseholds);
    assert.equal(sections.length, 3);
    assert.equal(sections[0].title, 'מגיעים');
    // Cohen and Levi sorted alphabetically
    assert.equal(sections[0].households[0].name, 'משפחת כהן');
    assert.equal(sections[0].households[1].name, 'משפחת לוי');

    assert.equal(sections[1].title, 'אולי / טרם השיבו');
    assert.equal(sections[1].households[0].name, 'משפחת אברהם');

    assert.equal(sections[2].title, 'לא מגיעים');
    assert.equal(sections[2].households[0].name, 'משפחת דוד');
  });

  it('paid sort groups by paidFull, paidPartial, unpaid, notComing', () => {
    const sections = buildHouseholdSections('paid', dummyHouseholds);
    assert.equal(sections.length, 4);
    assert.equal(sections[0].title, 'שילמו במלואו');
    assert.equal(sections[0].households[0].name, 'משפחת לוי');

    assert.equal(sections[1].title, 'שילמו חלקית');
    assert.equal(sections[1].households[0].name, 'משפחת כהן');

    assert.equal(sections[2].title, 'טרם שילמו');
    assert.equal(sections[2].households[0].name, 'משפחת אברהם');

    assert.equal(sections[3].title, 'לא מגיעים');
    assert.equal(sections[3].households[0].name, 'משפחת דוד');
  });
});
