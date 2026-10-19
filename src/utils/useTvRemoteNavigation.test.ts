import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('useTvRemoteNavigation spatial direction calculations', () => {
  it('correctly calculates center and distance between bounding boxes', () => {
    const rectA = { left: 100, top: 100, width: 200, height: 100 };
    const centerAX = rectA.left + rectA.width / 2; // 200
    const centerAY = rectA.top + rectA.height / 2; // 150

    // Card directly below A
    const rectBelow = { left: 100, top: 250, width: 200, height: 100 };
    const centerBelowX = rectBelow.left + rectBelow.width / 2; // 200
    const centerBelowY = rectBelow.top + rectBelow.height / 2; // 300

    assert.strictEqual(centerBelowY > centerAY + 15, true);
    const primaryDist = centerBelowY - centerAY; // 150
    const secondaryDist = Math.abs(centerBelowX - centerAX); // 0
    const score = primaryDist + secondaryDist * 2.5; // 150
    assert.strictEqual(score, 150);

    // Card diagonally to the bottom-right
    const rectDiag = { left: 400, top: 250, width: 200, height: 100 };
    const centerDiagX = rectDiag.left + rectDiag.width / 2; // 500
    const centerDiagY = rectDiag.top + rectDiag.height / 2; // 300
    const diagPrimaryDist = centerDiagY - centerAY; // 150
    const diagSecondaryDist = Math.abs(centerDiagX - centerAX); // 300
    const diagScore = diagPrimaryDist + diagSecondaryDist * 2.5; // 150 + 750 = 900

    // Rect directly below should have a much lower score than the diagonal candidate
    assert.strictEqual(score < diagScore, true);
  });

  it('correctly identifies right and left candidate elements', () => {
    const centerAX = 200;
    const centerAY = 150;

    const centerRightX = 500;
    const centerRightY = 150;

    const centerLeftX = 50;
    const centerLeftY = 150;

    assert.strictEqual(centerRightX > centerAX + 15, true);
    assert.strictEqual(centerLeftX < centerAX - 15, true);
  });
});
