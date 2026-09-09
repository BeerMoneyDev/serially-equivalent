/**
 * Additional correctness tests that cover gaps in the original suite:
 *
 *  1. Unordered-array duplicate-element bug (fixed in the optimised rewrite).
 *     [a, a] must NOT match [a, b] when requireArrayOrdering is off.
 *
 *  2. Deeply nested objects (5+ levels) – verifies path tracking works
 *     correctly all the way down the recursion.
 *
 *  3. excludedProperties edge cases – excluded path that partially matches
 *     (wrong depth) should still be compared; a non-matching non-excluded
 *     deep property should still return false.
 *
 *  4. requireArrayOrdering: true – explicit ordering enforced.
 */

import { seriallyEquivalent } from './serially-equivalent';

describe('serially-equivalent – additional correctness tests', () => {
  // -------------------------------------------------------------------------
  // Unordered-array duplicate-element bug
  // -------------------------------------------------------------------------
  describe('unordered array: duplicate-element consumption', () => {
    it('should return false when a has duplicates that exceed unique matches in b', () => {
      // [a, a] must NOT match [a, b] – 'a' can only consume one slot in b
      const actual = { arr: [{ v: 1 }, { v: 1 }] };
      const expected = { arr: [{ v: 1 }, { v: 2 }] };
      expect(
        seriallyEquivalent(actual, expected, { requireArrayOrdering: false }),
      ).toBeFalsy();
    });

    it('should return true when duplicates in a match duplicates in b', () => {
      // [a, a] should match [a, a]
      const actual = { arr: [{ v: 1 }, { v: 1 }] };
      const expected = { arr: [{ v: 1 }, { v: 1 }] };
      expect(
        seriallyEquivalent(actual, expected, { requireArrayOrdering: false }),
      ).toBeTruthy();
    });

    it('should return false when a and b each have duplicates but they differ', () => {
      // [a, a] should NOT match [b, b]
      const actual = { arr: [{ v: 1 }, { v: 1 }] };
      const expected = { arr: [{ v: 2 }, { v: 2 }] };
      expect(
        seriallyEquivalent(actual, expected, { requireArrayOrdering: false }),
      ).toBeFalsy();
    });

    it('should correctly match a larger unordered array with all distinct elements', () => {
      const actual = { arr: [{ v: 3 }, { v: 1 }, { v: 2 }] };
      const expected = { arr: [{ v: 1 }, { v: 2 }, { v: 3 }] };
      expect(
        seriallyEquivalent(actual, expected, { requireArrayOrdering: false }),
      ).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Deeply nested objects
  // -------------------------------------------------------------------------
  describe('deeply nested objects', () => {
    // Build a 6-level deep identical object pair
    const makeDeep = (value: number) => ({
      a: { b: { c: { d: { e: { f: value } } } } },
    });

    it('should return true for a 6-level-deep matching object', () => {
      expect(seriallyEquivalent(makeDeep(42), makeDeep(42))).toBeTruthy();
    });

    it('should return false for a 6-level-deep object with a leaf mismatch', () => {
      expect(seriallyEquivalent(makeDeep(42), makeDeep(99))).toBeFalsy();
    });

    it('should correctly apply excludedProperties to a deep leaf', () => {
      expect(
        seriallyEquivalent(makeDeep(42), makeDeep(99), {
          excludedProperties: ['root.a.b.c.d.e.f'],
        }),
      ).toBeTruthy();
    });

    it('should exclude an intermediate node, skipping its entire subtree', () => {
      // 'root.a.b.c.d.e' points to the object {f: value}.
      // The library checks exclusions at the moment it visits each node, so
      // the whole {f: 42} vs {f: 99} subtree is skipped → true.
      expect(
        seriallyEquivalent(makeDeep(42), makeDeep(99), {
          excludedProperties: ['root.a.b.c.d.e'],
        }),
      ).toBeTruthy();
    });

    it('should NOT exclude when the excluded path points to a different key', () => {
      // 'root.a.b.c.d.OTHER' does not exist in the object; the diff at
      // root.a.b.c.d.e is still compared → false.
      expect(
        seriallyEquivalent(makeDeep(42), makeDeep(99), {
          excludedProperties: ['root.a.b.c.d.OTHER'],
        }),
      ).toBeFalsy();
    });
  });

  // -------------------------------------------------------------------------
  // excludedProperties edge cases
  // -------------------------------------------------------------------------
  describe('excludedProperties edge cases', () => {
    it('should exclude an intermediate object key, skipping its whole subtree', () => {
      const a = { x: { y: 1 } };
      const b = { x: { y: 2 } };
      // 'root.x' points to the object {y: 1} / {y: 2}.  The node is excluded
      // before its children are recursed into, so the diff in y is never seen.
      expect(
        seriallyEquivalent(a, b, { excludedProperties: ['root.x'] }),
      ).toBeTruthy();
    });

    it('should NOT exclude when the path names a different sibling key', () => {
      const a = { x: { y: 1 } };
      const b = { x: { y: 2 } };
      // 'root.z' does not exist; the diff at root.x.y is still compared.
      expect(
        seriallyEquivalent(a, b, { excludedProperties: ['root.z'] }),
      ).toBeFalsy();
    });

    it('should return false when the excluded path is a suffix extension (too deep)', () => {
      const a = { x: { y: 1 } };
      const b = { x: { y: 2 } };
      // 'root.x.y.z' is 4 segments; actual diff is at 'root.x.y' (3 segs)
      expect(
        seriallyEquivalent(a, b, { excludedProperties: ['root.x.y.z'] }),
      ).toBeFalsy();
    });

    it('should return true when multiple exclusions are specified and all diffs are excluded', () => {
      const a = { x: 1, y: 2 };
      const b = { x: 9, y: 8 };
      expect(
        seriallyEquivalent(a, b, {
          excludedProperties: ['root.x', 'root.y'],
        }),
      ).toBeTruthy();
    });

    it('should return false when only one of two diffs is excluded', () => {
      const a = { x: 1, y: 2 };
      const b = { x: 9, y: 8 };
      expect(
        seriallyEquivalent(a, b, {
          excludedProperties: ['root.x'],
        }),
      ).toBeFalsy();
    });
  });

  // -------------------------------------------------------------------------
  // requireArrayOrdering: true (explicit)
  // -------------------------------------------------------------------------
  describe('requireArrayOrdering: true', () => {
    it('should return false for reordered arrays when ordering is required', () => {
      const a = { arr: [{ v: 1 }, { v: 2 }] };
      const b = { arr: [{ v: 2 }, { v: 1 }] };
      expect(
        seriallyEquivalent(a, b, { requireArrayOrdering: true }),
      ).toBeFalsy();
    });

    it('should return true for same-ordered arrays when ordering is required', () => {
      const a = { arr: [{ v: 1 }, { v: 2 }] };
      const b = { arr: [{ v: 1 }, { v: 2 }] };
      expect(
        seriallyEquivalent(a, b, { requireArrayOrdering: true }),
      ).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // debug callback coverage
  // -------------------------------------------------------------------------
  describe('debug callback', () => {
    it('should invoke the debug callback on mismatch', () => {
      const messages: string[] = [];
      seriallyEquivalent(
        { x: 1 },
        { x: 2 },
        {
          debug: (msg) => messages.push(msg),
        },
      );
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toContain('root.x');
    });

    it('should NOT invoke the debug callback when values match', () => {
      const messages: string[] = [];
      seriallyEquivalent(
        { x: 1 },
        { x: 1 },
        {
          debug: (msg) => messages.push(msg),
        },
      );
      expect(messages.length).toBe(0);
    });
  });
});
