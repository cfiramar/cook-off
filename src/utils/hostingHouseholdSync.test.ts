import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeHostingSyncActions,
  calculateStillVotingCount,
  isHostingChef,
  type HostingHousehold
} from './hostingHouseholdSync.ts';
import type { Guest } from '../hooks/useFirebaseData.ts';

describe('hostingHouseholdSync unit tests', () => {
  const sampleHostingHousehold: HostingHousehold = {
    id: 'hh_host_1',
    name: 'מארחים',
    members: [
      {
        id: 'hm_1',
        name: 'דניאל המארח',
        pin: '1111',
        includeInEveryEvent: true,
        canVote: false, // cannot vote
        shouldPayFee: true // should pay fee
      },
      {
        id: 'hm_2',
        name: 'שירה המארחת',
        pin: '2222',
        includeInEveryEvent: true,
        canVote: true, // can vote
        shouldPayFee: false // fee exempt
      },
      {
        id: 'hm_3',
        name: 'יוני (אורח קבוע שלא כלול תמיד)',
        pin: '3333',
        includeInEveryEvent: false, // NOT included in every event
        canVote: true,
        shouldPayFee: true
      }
    ]
  };

  it('generates add actions for members with includeInEveryEvent=true', () => {
    const currentGuests: Guest[] = [];
    const actions = computeHostingSyncActions(sampleHostingHousehold, currentGuests);

    assert.strictEqual(actions.length, 2);
    assert.strictEqual(actions[0].type, 'add');
    assert.strictEqual(actions[0].data?.name, 'דניאל המארח');
    assert.strictEqual(actions[0].data?.canVote, false);
    assert.strictEqual(actions[0].data?.shouldPayFee, true);
    assert.strictEqual(actions[0].data?.rsvpStatus, 'coming');
    assert.strictEqual(actions[0].data?.paid, true);

    assert.strictEqual(actions[1].type, 'add');
    assert.strictEqual(actions[1].data?.name, 'שירה המארחת');
    assert.strictEqual(actions[1].data?.canVote, true);
    assert.strictEqual(actions[1].data?.shouldPayFee, false);
    assert.strictEqual(actions[1].data?.paid, false);
  });

  it('updates existing hosting members if properties changed', () => {
    const currentGuests: Guest[] = [
      {
        id: 'g_host_1',
        name: 'דניאל המארח',
        pin: '1111',
        status: 'not_logged_in',
        rsvpStatus: 'maybe', // should be updated to 'coming'
        isHostingMember: true,
        hostingMemberId: 'hm_1',
        canVote: true, // was true, now false in household
        shouldPayFee: true,
        paid: true
      }
    ];

    const actions = computeHostingSyncActions(sampleHostingHousehold, currentGuests);
    // 1 update for hm_1, 1 add for hm_2
    const updateAction = actions.find(a => a.type === 'update');
    assert.ok(updateAction);
    assert.strictEqual(updateAction.guestId, 'g_host_1');
    assert.strictEqual(updateAction.data?.canVote, false);
    assert.strictEqual(updateAction.data?.rsvpStatus, 'coming');
  });

  it('calculateStillVotingCount excludes hosting members that cannot vote (canVote === false)', () => {
    const guests: Guest[] = [
      {
        id: 'g_1',
        name: 'דניאל (מארח שלא מצביע)',
        pin: '1111',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        canVote: false
      },
      {
        id: 'g_2',
        name: 'שירה (מארחת שמצביעה)',
        pin: '2222',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        canVote: true
      },
      {
        id: 'g_3',
        name: 'אורח רגיל',
        pin: '3333',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        canVote: true
      }
    ];

    // No votes yet
    const initial = calculateStillVotingCount(guests, []);
    // Only g_2 and g_3 are eligible voters (total 2). g_1 is excluded.
    assert.strictEqual(initial.eligibleVotersCount, 2);
    assert.strictEqual(initial.stillVotingCount, 2);
    assert.strictEqual(initial.stillVotingText, '2 אנשים עדיין מצביעים');

    // g_2 votes (2 votes)
    const votes = [
      { guestId: 'g_2', mealId: 'm1' },
      { guestId: 'g_2', mealId: 'm2' }
    ];
    const afterOneVotes = calculateStillVotingCount(guests, votes);
    assert.strictEqual(afterOneVotes.stillVotingCount, 1);
    assert.strictEqual(afterOneVotes.stillVotingText, 'אדם 1 עדיין מצביע');

    // g_3 also votes
    votes.push({ guestId: 'g_3', mealId: 'm1' });
    votes.push({ guestId: 'g_3', mealId: 'm2' });
    const allDone = calculateStillVotingCount(guests, votes);
    assert.strictEqual(allDone.stillVotingCount, 0);
  });

  it('isHostingChef correctly identifies hosting members and hosting households', () => {
    const guests: Guest[] = [
      {
        id: 'g_host_1',
        name: 'דניאל המארח',
        pin: '1111',
        status: 'not_logged_in',
        isHostingMember: true,
        householdId: 'hh_host_1'
      },
      {
        id: 'g_regular',
        name: 'אורח רגיל',
        pin: '4444',
        status: 'not_logged_in',
        householdId: 'hh_other'
      }
    ];

    assert.strictEqual(isHostingChef('g_host_1', guests, 'hh_host_1'), true);
    assert.strictEqual(isHostingChef('hh_host_1', guests, 'hh_host_1'), true);
    assert.strictEqual(isHostingChef('g_regular', guests, 'hh_host_1'), false);
    assert.strictEqual(isHostingChef('hh_other', guests, 'hh_host_1'), false);
  });

  it('assigns targetDocId for deterministic additions to prevent Firestore duplicates', () => {
    const actions = computeHostingSyncActions(sampleHostingHousehold, []);
    assert.strictEqual(actions.length, 2);
    assert.strictEqual(actions[0].type, 'add');
    assert.strictEqual(actions[0].targetDocId, 'host_hm_1');
    assert.strictEqual(actions[1].type, 'add');
    assert.strictEqual(actions[1].targetDocId, 'host_hm_2');
  });

  it('cleans up duplicate copies of hosting household members, keeping only one and removing duplicates', () => {
    const currentGuests: Guest[] = [
      // 3 copies of Daniel (hm_1)
      {
        id: 'dup_daniel_1',
        name: 'דניאל המארח',
        pin: '1111',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        isHostingMember: true,
        hostingMemberId: 'hm_1',
        householdId: 'hh_host_1',
        canVote: false,
        shouldPayFee: true
      },
      {
        id: 'dup_daniel_2',
        name: 'דניאל המארח',
        pin: '1111',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        isHostingMember: true,
        hostingMemberId: 'hm_1',
        householdId: 'hh_host_1',
        canVote: false,
        shouldPayFee: true
      },
      {
        id: 'dup_daniel_3',
        name: 'דניאל המארח',
        pin: '1111',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        isHostingMember: true,
        hostingMemberId: 'hm_1',
        householdId: 'hh_host_1',
        canVote: false,
        shouldPayFee: true
      },
      // 2 copies of Shira (hm_2)
      {
        id: 'dup_shira_1',
        name: 'שירה המארחת',
        pin: '2222',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        isHostingMember: true,
        hostingMemberId: 'hm_2',
        householdId: 'hh_host_1',
        canVote: true,
        shouldPayFee: false
      },
      {
        id: 'dup_shira_2',
        name: 'שירה המארחת',
        pin: '2222',
        status: 'not_logged_in',
        rsvpStatus: 'coming',
        isHostingMember: true,
        hostingMemberId: 'hm_2',
        householdId: 'hh_host_1',
        canVote: true,
        shouldPayFee: false
      },
      // 1 regular guest
      {
        id: 'regular_guest_1',
        name: 'שמעון אורח',
        pin: '9999',
        status: 'not_logged_in',
        rsvpStatus: 'coming'
      }
    ];

    const actions = computeHostingSyncActions(sampleHostingHousehold, currentGuests);

    // Should find 0 additions
    const addActions = actions.filter(a => a.type === 'add');
    assert.strictEqual(addActions.length, 0);

    // Should remove exactly 2 copies of Daniel and 1 copy of Shira (total 3 removals)
    const removeActions = actions.filter(a => a.type === 'remove');
    assert.strictEqual(removeActions.length, 3);

    const removedGuestIds = removeActions.map(a => a.guestId);
    assert.ok(removedGuestIds.includes('dup_daniel_2') || removedGuestIds.includes('dup_daniel_3'));
    assert.ok(removedGuestIds.includes('dup_shira_2'));
    assert.strictEqual(removedGuestIds.includes('regular_guest_1'), false);
  });
});
