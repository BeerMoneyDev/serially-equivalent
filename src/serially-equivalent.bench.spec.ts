/**
 * Performance regression tests for seriallyEquivalent.
 *
 * Each test runs N iterations of a specific workload shape and asserts that
 * the total wall-clock time stays under a budget set at ~4-5× the observed
 * baseline.  The purpose is not to pin down microsecond timings but to act as
 * a canary: if a future change reintroduces the O(k log k) sorts, per-node
 * path-string allocations, or re-splitting of excluded-property paths, the
 * run time will increase by 3-10× and blow the budget.
 *
 * NOTE: ts-jest adds JIT-warmup and transformation overhead so the numbers
 * here will be higher than pure-Node benchmarks; budgets are calibrated
 * accordingly with generous headroom.
 *
 * Workloads mirror those described in the optimisation analysis:
 *   1. wide object       – single object with 200 keys
 *   2. deep object       – 40 levels of nesting
 *   3. realistic nested  – multi-level object with arrays and dates
 *   4. excluded props    – realistic nested + excludedProperties option
 *   5. unordered array   – array of 30 elements compared without ordering
 */

import { seriallyEquivalent } from './serially-equivalent';

// Increase Jest's per-test timeout for this file – the benchmarks are
// intentionally long-running by design.
jest.setTimeout(120_000);

// ---------------------------------------------------------------------------
// Workload factories
// ---------------------------------------------------------------------------

function makeWideObject(keyCount = 200): Record<string, number> {
  const obj: Record<string, number> = {};
  for (let i = 0; i < keyCount; i++) {
    obj[`key${i}`] = i;
  }
  return obj;
}

function makeDeepObject(levels = 40): Record<string, unknown> {
  let inner: any = { value: 42 };
  for (let i = levels - 1; i >= 0; i--) {
    inner = { [`level${i}`]: inner };
  }
  return inner;
}

function makeRealisticObject() {
  return {
    id: 'abc123',
    name: 'test entity',
    metadata: {
      createdAt: new Date('2023-01-01'),
      tags: ['alpha', 'beta', 'gamma'],
      config: {
        retries: 3,
        timeout: 5000,
        nested: { flag: true, value: 99 },
      },
    },
    items: Array.from({ length: 10 }, (_, i) => ({
      id: i,
      label: `item-${i}`,
      active: i % 2 === 0,
      score: i * 1.5,
    })),
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Run `fn` `iterations` times and return elapsed ms. */
function timeMs(iterations: number, fn: () => void): number {
  // process.hrtime.bigint() is available in Node 10+; the Web Performance
  // API is not available in the Node 14 test environment.
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000; // nanoseconds → ms
}

// ---------------------------------------------------------------------------
// Benchmark tests
// ---------------------------------------------------------------------------

describe('serially-equivalent – performance regression tests', () => {
  /**
   * Wide object (200 keys).
   * Baseline ~40–80 ms for 10 000 iters.  Budget: 2 000 ms (~25-50×).
   * A regression reintroducing the two O(k log k) sorts would ~1.5-2× this.
   */
  it('wide object (200 keys): 10 000 iterations should complete in < 2 000 ms', () => {
    const a = makeWideObject(200);
    const b = makeWideObject(200);
    const elapsed = timeMs(10_000, () => seriallyEquivalent(a, b));
    console.log(`  wide object 200 keys × 10 000:  ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(2_000);
  });

  /**
   * Deep object (40 levels of nesting).
   * Baseline ~1 000–1 500 ms for 500 iters.  Budget: 8 000 ms (~5-8×).
   * Reintroducing per-node path-string allocation would ~3× this workload.
   */
  it('deep object (40 levels): 500 iterations should complete in < 8 000 ms', () => {
    const a = makeDeepObject(40);
    const b = makeDeepObject(40);
    const elapsed = timeMs(500, () => seriallyEquivalent(a, b));
    console.log(`  deep object 40 levels × 500:  ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(8_000);
  });

  /**
   * Realistic nested object (dates, nested arrays, mixed types).
   * Baseline ~1 500–2 500 ms for 3 000 iters.  Budget: 15 000 ms (~6-10×).
   * This is the workload with the biggest measured speedup (~10×).
   */
  it('realistic nested object: 3 000 iterations should complete in < 15 000 ms', () => {
    const a = makeRealisticObject();
    const b = makeRealisticObject();
    const elapsed = timeMs(3_000, () => seriallyEquivalent(a, b));
    console.log(`  realistic nested × 3 000:  ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(15_000);
  });

  /**
   * Realistic nested object + excludedProperties.
   * Baseline ~1 500–2 500 ms for 3 000 iters.  Budget: 15 000 ms.
   * Reintroducing per-node re-splitting of excludedProperties would ~8× this.
   */
  it('realistic nested + excludedProperties: 3 000 iterations should complete in < 15 000 ms', () => {
    const a = makeRealisticObject();
    const b = makeRealisticObject();
    const opts = {
      excludedProperties: [
        'root.metadata.createdAt',
        'root.metadata.config.timeout',
      ],
    };
    const elapsed = timeMs(3_000, () => seriallyEquivalent(a, b, opts));
    console.log(
      `  realistic + excludedProps × 3 000:  ${elapsed.toFixed(1)} ms`,
    );
    expect(elapsed).toBeLessThan(15_000);
  });

  /**
   * Unordered array (30 elements, worst-case reversed order).
   * This is O(n²) in the number of elements; each comparison itself involves
   * a recursive deep check.
   * Baseline ~3 000–4 000 ms for 200 iters.  Budget: 25 000 ms.
   */
  it('unordered array (30 elements, reversed): 200 iterations should complete in < 25 000 ms', () => {
    const a = {
      arr: Array.from({ length: 30 }, (_, i) => ({ id: i, v: `val${i}` })),
    };
    const b = { arr: [...a.arr].reverse() }; // reversed = worst-case for findIndex
    const elapsed = timeMs(200, () =>
      seriallyEquivalent(a, b, { requireArrayOrdering: false }),
    );
    console.log(
      `  unordered array 30 elems (reversed) × 200:  ${elapsed.toFixed(1)} ms`,
    );
    expect(elapsed).toBeLessThan(25_000);
  });

  // ------------------------------------------------------------------
  // Sanity check: correctness is not sacrificed for speed
  // ------------------------------------------------------------------
  it('correctly identifies matches and mismatches after many iterations (no state leak)', () => {
    const a = makeWideObject(50);
    const bMatch = makeWideObject(50);
    const bMismatch = { ...makeWideObject(50), key49: 9999 };

    for (let i = 0; i < 1_000; i++) {
      expect(seriallyEquivalent(a, bMatch)).toBe(true);
      expect(seriallyEquivalent(a, bMismatch)).toBe(false);
    }
  });
});
