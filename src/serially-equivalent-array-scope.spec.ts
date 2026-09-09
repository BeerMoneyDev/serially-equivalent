import { seriallyEquivalent } from './serially-equivalent';
import { SeriallyEquivalentOptions } from './serially-equivalent-options.interface';

describe('serially-equivalent arrayOrderingScope', () => {
  const unordered: SeriallyEquivalentOptions = { requireArrayOrdering: false };
  const unorderedAll: SeriallyEquivalentOptions = {
    requireArrayOrdering: false,
    arrayOrderingScope: 'all',
  };
  const unorderedProperties: SeriallyEquivalentOptions = {
    requireArrayOrdering: false,
    arrayOrderingScope: 'properties',
  };

  describe("default scope ('properties')", () => {
    it('should still compare root arrays index by index', () => {
      expect(seriallyEquivalent([1, 2], [2, 1], unordered)).toBeFalsy();
      expect(
        seriallyEquivalent([1, 2], [2, 1], unorderedProperties),
      ).toBeFalsy();
      expect(seriallyEquivalent([1, 2], [1, 2], unordered)).toBeTruthy();
    });

    it('should still compare arrays nested inside arrays index by index', () => {
      expect(
        seriallyEquivalent(
          { a: [[1, 2], [3]] },
          { a: [[3], [2, 1]] },
          unordered,
        ),
      ).toBeFalsy();
      expect(
        seriallyEquivalent(
          { a: [[1, 2], [3]] },
          { a: [[3], [1, 2]] },
          unordered,
        ),
      ).toBeTruthy();
    });
  });

  describe("scope 'all'", () => {
    it('should treat reordered root arrays as equivalent', () => {
      expect(seriallyEquivalent([1, 2], [2, 1], unorderedAll)).toBeTruthy();
      expect(
        seriallyEquivalent(
          [{ name: 'Ben' }, { name: 'Sam' }],
          [{ name: 'Sam' }, { name: 'Ben' }],
          unorderedAll,
        ),
      ).toBeTruthy();
    });

    it('should not match root arrays with different elements', () => {
      expect(seriallyEquivalent([1, 2], [1, 3], unorderedAll)).toBeFalsy();
    });

    it('should not match root arrays with different lengths', () => {
      expect(seriallyEquivalent([1, 2], [1, 2, 3], unorderedAll)).toBeFalsy();
      expect(seriallyEquivalent([1, 2, 3], [1, 2], unorderedAll)).toBeFalsy();
    });

    it('should not let duplicates match a single element twice', () => {
      expect(seriallyEquivalent([1, 1], [1, 2], unorderedAll)).toBeFalsy();
      expect(seriallyEquivalent([1, 2], [1, 1], unorderedAll)).toBeFalsy();
      expect(seriallyEquivalent([1, 1], [1, 1], unorderedAll)).toBeTruthy();
    });

    it('should treat reordered arrays nested inside arrays as equivalent', () => {
      expect(
        seriallyEquivalent([[1, 2], [3]], [[3], [2, 1]], unorderedAll),
      ).toBeTruthy();
      expect(
        seriallyEquivalent(
          { a: [[1, 2], [3]] },
          { a: [[3], [2, 1]] },
          unorderedAll,
        ),
      ).toBeTruthy();
      expect(
        seriallyEquivalent([[1, 2], [3]], [[3], [2, 4]], unorderedAll),
      ).toBeFalsy();
    });

    it('should still require ordering when requireArrayOrdering is true', () => {
      const orderedAll: SeriallyEquivalentOptions = {
        requireArrayOrdering: true,
        arrayOrderingScope: 'all',
      };
      expect(seriallyEquivalent([1, 2], [2, 1], orderedAll)).toBeFalsy();
      expect(
        seriallyEquivalent({ a: [1, 2] }, { a: [2, 1] }, orderedAll),
      ).toBeFalsy();
      expect(seriallyEquivalent([1, 2], [1, 2], orderedAll)).toBeTruthy();
    });

    it('should log the mismatch at the root path', () => {
      const messages: string[] = [];
      expect(
        seriallyEquivalent([1, 2], [1, 3], {
          ...unorderedAll,
          debug: (msg) => messages.push(msg),
        }),
      ).toBeFalsy();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('Equivalence failed at root for issue:');
      expect(messages[0]).toContain(
        'Array ignore ordering no matching element',
      );
    });
  });

  describe('unchanged behaviour under both scopes', () => {
    it.each([
      ['properties', unorderedProperties],
      ['all', unorderedAll],
    ])(
      'should compare object array properties the same under %s',
      (_scope, opts) => {
        expect(
          seriallyEquivalent({ a: [1, 2] }, { a: [2, 1] }, opts),
        ).toBeTruthy();
        expect(
          seriallyEquivalent({ a: [1, 2] }, { a: [1, 3] }, opts),
        ).toBeFalsy();
        expect(
          seriallyEquivalent({ a: [1, 2] }, { a: [1, 2, 3] }, opts),
        ).toBeFalsy();
        expect(
          seriallyEquivalent(
            { a: [{ n: 1 }, { n: 2 }], b: 'x' },
            { b: 'x', a: [{ n: 2 }, { n: 1 }] },
            opts,
          ),
        ).toBeTruthy();
      },
    );

    it.each([
      ['properties', unorderedProperties],
      ['all', unorderedAll],
    ])(
      'should leave scalars, Dates and Buffers alone under %s',
      (_scope, opts) => {
        expect(seriallyEquivalent(1, 1, opts)).toBeTruthy();
        expect(seriallyEquivalent(1, 2, opts)).toBeFalsy();
        expect(seriallyEquivalent('a', 'a', opts)).toBeTruthy();
        expect(seriallyEquivalent('a', 'b', opts)).toBeFalsy();
        expect(seriallyEquivalent(null, null, opts)).toBeTruthy();
        expect(seriallyEquivalent<any>(null, 0, opts)).toBeFalsy();
        expect(seriallyEquivalent<any>([1], 1, opts)).toBeFalsy();
        expect(
          seriallyEquivalent(new Date(100), new Date(100), opts),
        ).toBeTruthy();
        expect(
          seriallyEquivalent(new Date(100), new Date(101), opts),
        ).toBeFalsy();
        expect(
          seriallyEquivalent(Buffer.from([1, 2]), Buffer.from([1, 2]), opts),
        ).toBeTruthy();
        expect(
          seriallyEquivalent(Buffer.from([1, 2]), Buffer.from([2, 1]), opts),
        ).toBeFalsy();
        expect(
          seriallyEquivalent(
            [Buffer.from([1, 2])],
            [Buffer.from([2, 1])],
            opts,
          ),
        ).toBeFalsy();
      },
    );
  });
});
