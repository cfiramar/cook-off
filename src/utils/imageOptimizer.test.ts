import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ImageOptimizerService } from './imageOptimizer.ts';

describe('ImageOptimizerService - Dimension calculations & constraints', () => {
  it('correctly resizes landscape images exceeding maxWidth', () => {
    // 4000x3000 down to maxWidth 800
    const dims = ImageOptimizerService.calculateDimensions(4000, 3000, 800);
    assert.strictEqual(dims.width, 800);
    assert.strictEqual(dims.height, 600);
  });

  it('correctly resizes portrait images exceeding maxWidth', () => {
    // 3000x4000 down to maxWidth 800
    const dims = ImageOptimizerService.calculateDimensions(3000, 4000, 800);
    assert.strictEqual(dims.width, 800);
    assert.strictEqual(dims.height, 1067); // 4000 * (800 / 3000) = 1066.67 => 1067
  });

  it('does not upscale images smaller than maxWidth', () => {
    // 640x480 with maxWidth 800 stays 640x480
    const dims = ImageOptimizerService.calculateDimensions(640, 480, 800);
    assert.strictEqual(dims.width, 640);
    assert.strictEqual(dims.height, 480);
  });

  it('respects maxHeight constraint if specified', () => {
    // 1000x2000 with maxWidth 800 and maxHeight 1200
    // Width scales to 800, height would be 1600. Since 1600 > 1200, height scales to 1200 and width to 600.
    const dims = ImageOptimizerService.calculateDimensions(1000, 2000, 800, 1200);
    assert.strictEqual(dims.width, 600);
    assert.strictEqual(dims.height, 1200);
  });

  it('handles edge cases gracefully (zero or negative dimensions)', () => {
    const dims = ImageOptimizerService.calculateDimensions(0, 0, 800);
    assert.strictEqual(dims.width, 1);
    assert.strictEqual(dims.height, 1);
  });

  it('gracefully returns original file in non-browser/node environment', async () => {
    // Node environment has no window/document
    const mockFile = { name: 'test.jpg' } as any;
    const result = await ImageOptimizerService.createLightweightCopy(mockFile);
    assert.strictEqual(result, mockFile);
  });
});
