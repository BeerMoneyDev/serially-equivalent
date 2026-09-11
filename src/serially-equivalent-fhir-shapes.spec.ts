/**
 * Hand-written FHIR-shaped regression cases for a change-detection consumer.
 *
 * Every case asserts the expected boolean AND that the live implementation and
 * the frozen main@6622ee8 reference (src/__fixtures__) agree, under each
 * option set. main@6622ee8 already carries arrayOrderingScope (PR #2), so the
 * 'all' cases are checked against the reference too.
 */
import { seriallyEquivalent } from './serially-equivalent';
import { SeriallyEquivalentOptions } from './serially-equivalent-options.interface';
import { referenceSeriallyEquivalent } from './__fixtures__/reference-serially-equivalent';

const DEFAULT: SeriallyEquivalentOptions = {};
const ORDERED: SeriallyEquivalentOptions = { requireArrayOrdering: true };
const UNORDERED: SeriallyEquivalentOptions = { requireArrayOrdering: false };
const UNORDERED_ALL: SeriallyEquivalentOptions = {
  requireArrayOrdering: false,
  arrayOrderingScope: 'all',
};
const ALL_OPTIONS: [string, SeriallyEquivalentOptions][] = [
  ['{}', DEFAULT],
  ['{requireArrayOrdering:true}', ORDERED],
  ['{requireArrayOrdering:false}', UNORDERED],
  ["{requireArrayOrdering:false, arrayOrderingScope:'all'}", UNORDERED_ALL],
];

function runBoth(a: any, b: any, opts: SeriallyEquivalentOptions) {
  const newMsgs: string[] = [];
  const refMsgs: string[] = [];
  const result = seriallyEquivalent(a, b, {
    ...opts,
    debug: (m) => newMsgs.push(m),
  });
  const reference = referenceSeriallyEquivalent(a, b, {
    ...opts,
    debug: (m) => refMsgs.push(m),
  });
  return { result, reference, newMsgs, refMsgs };
}

/**
 * Assert the expected result, that both implementations agree on it, and (for
 * a false result) that the first debug message is identical. Every case below
 * changes a single site, so the first message is well defined — see the
 * "KNOWN DIVERGENCE" block for what happens with several differing sites.
 */
function expectBoth(
  a: any,
  b: any,
  opts: SeriallyEquivalentOptions,
  expected: boolean,
) {
  const { result, reference, newMsgs, refMsgs } = runBoth(a, b, opts);
  expect(result).toBe(expected);
  expect(reference).toBe(expected);
  if (!expected) {
    expect(newMsgs.length).toBeGreaterThan(0);
    expect(newMsgs[0]).toBe(refMsgs[0]);
  }
  // No-debug fast path must give the same answer as the debug path.
  expect(seriallyEquivalent(a, b, opts)).toBe(expected);
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

const patient = () => ({
  resourceType: 'Patient',
  id: 'pat-1',
  meta: {
    versionId: '3',
    lastUpdated: '2024-05-01T10:00:00.000Z',
    source: 'clinical-loader',
    tag: [{ system: 'http://lumeris.com/tag', code: 'gold' }],
  },
  identifier: [
    { use: 'official', system: 'http://lumeris.com/ers', value: 'ERS-0001' },
    { use: 'usual', system: 'http://hospital.example/mrn', value: 'MRN-123' },
    { system: 'http://hl7.org/fhir/sid/us-ssn', value: '999-99-9999' },
  ],
  active: true,
  name: [
    {
      use: 'official',
      family: 'Main',
      given: ['Benjamin', 'Samuel'],
      prefix: ['Mr'],
    },
    { use: 'nickname', given: ['Ben'] },
  ],
  telecom: [
    { system: 'phone', value: '555-0100', use: 'home' },
    { system: 'phone', value: '555-0101', use: 'mobile' },
    { system: 'email', value: 'ben@example.com' },
  ],
  gender: 'male',
  birthDate: '1980-02-29',
  address: [
    {
      use: 'home',
      line: ['1 Main St', 'Apt 4'],
      city: 'St. Louis',
      state: 'MO',
      postalCode: '63101',
      period: { start: '2015-01-01' },
    },
    {
      use: 'old',
      line: ['9 Old Rd'],
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
    },
  ],
  extension: [
    {
      url: 'http://lumeris.com/fhir/StructureDefinition/attribution-period',
      valuePeriod: { start: '2024-01-01', end: '2024-12-31' },
    },
    {
      url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
      extension: [
        {
          url: 'ombCategory',
          valueCoding: {
            system: 'urn:oid:2.16.840.1.113883.6.238',
            code: '2106-3',
          },
        },
        { url: 'text', valueString: 'White' },
      ],
    },
  ],
  generalPractitioner: [
    { reference: 'Practitioner/prac-1', display: 'Dr. One' },
    { reference: 'PractitionerRole/role-7' },
  ],
  managingOrganization: { reference: 'Organization/org-1' },
});

const practitioner = () => ({
  resourceType: 'Practitioner',
  id: 'prac-1',
  identifier: [
    { system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' },
  ],
  name: [{ family: 'One', given: ['Doctor'] }],
  qualification: [
    {
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'MD',
          },
        ],
      },
      period: { start: '2001-06-01' },
      issuer: { reference: 'Organization/med-school' },
    },
    {
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
            code: 'PhD',
          },
        ],
      },
    },
  ],
});

const coverage = () => ({
  resourceType: 'Coverage',
  id: 'cov-1',
  status: 'active',
  beneficiary: { reference: 'Patient/pat-1' },
  payor: [{ reference: 'Organization/payer-1' }],
  period: { start: '2024-01-01', end: '2024-12-31' },
  class: [
    {
      type: { coding: [{ code: 'group' }] },
      value: 'GRP-100',
      name: 'Group 100',
    },
    { type: { coding: [{ code: 'plan' }] }, value: 'PLAN-A' },
    { type: { coding: [{ code: 'subplan' }] }, value: 'SUB-1' },
  ],
});

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

describe('FHIR-shaped resources: new implementation and main@6622ee8 agree', () => {
  describe('identical resources', () => {
    it.each(ALL_OPTIONS)(
      'Patient, Practitioner, Coverage are equal under %s',
      (_n, opts) => {
        expectBoth(patient(), patient(), opts, true);
        expectBoth(practitioner(), practitioner(), opts, true);
        expectBoth(coverage(), coverage(), opts, true);
      },
    );

    it.each(ALL_OPTIONS)(
      'key insertion order never matters under %s',
      (_n, opts) => {
        const a = patient();
        const b = patient();
        // rebuild identifier[1] and address[0] with keys in a different order
        b.identifier[1] = {
          value: 'MRN-123',
          system: 'http://hospital.example/mrn',
          use: 'usual',
        };
        b.address[0] = {
          period: { start: '2015-01-01' },
          postalCode: '63101',
          state: 'MO',
          city: 'St. Louis',
          line: ['1 Main St', 'Apt 4'],
          use: 'home',
        };
        expectBoth(a, b, opts, true);
      },
    );
  });

  describe('identifier[] in a different order', () => {
    const a = patient();
    const b = patient();
    b.identifier = [b.identifier[2], b.identifier[0], b.identifier[1]];

    it('is equal when ordering is not required (default and explicit)', () => {
      expectBoth(a, b, DEFAULT, true);
      expectBoth(a, b, UNORDERED, true);
      expectBoth(a, b, UNORDERED_ALL, true);
    });
    it('is different when ordering is required', () => {
      expectBoth(a, b, ORDERED, false);
    });
  });

  describe('nested given[] reordered inside name[0]', () => {
    const a = patient();
    const b = patient();
    b.name[0].given = ['Samuel', 'Benjamin'];

    it('is equal under requireArrayOrdering:false (a nested array is still a property)', () => {
      expectBoth(a, b, DEFAULT, true);
      expectBoth(a, b, UNORDERED, true);
      expectBoth(a, b, UNORDERED_ALL, true);
    });
    it('is different when ordering is required', () => {
      expectBoth(a, b, ORDERED, false);
    });
  });

  describe('Coverage.class[] and Practitioner.qualification[] reordered', () => {
    it('follow the same rule as any property array', () => {
      const c1 = coverage();
      const c2 = coverage();
      c2.class = [c2.class[2], c2.class[1], c2.class[0]];
      expectBoth(c1, c2, DEFAULT, true);
      expectBoth(c1, c2, ORDERED, false);

      const p1 = practitioner();
      const p2 = practitioner();
      p2.qualification.reverse();
      expectBoth(p1, p2, UNORDERED, true);
      expectBoth(p1, p2, ORDERED, false);
    });
  });

  describe('root-level array of resources reordered (a Bundle-less batch)', () => {
    const a = [patient(), practitioner(), coverage()];
    const b = [coverage(), patient(), practitioner()];

    it("is equal only under arrayOrderingScope:'all'", () => {
      expectBoth(a, b, UNORDERED_ALL, true);
    });
    it('is different under every other option set (root array stays index-by-index)', () => {
      expectBoth(a, b, DEFAULT, false);
      expectBoth(a, b, UNORDERED, false);
      expectBoth(a, b, ORDERED, false);
    });
    it('matches wrapping the root array as a property under requireArrayOrdering:false', () => {
      expect(seriallyEquivalent(a, b, UNORDERED_ALL)).toBe(
        referenceSeriallyEquivalent({ v: a }, { v: b }, UNORDERED),
      );
    });
  });

  describe('an identifier value changed deep inside', () => {
    const a = patient();
    const b = patient();
    b.identifier[1].value = 'MRN-124';

    it.each(ALL_OPTIONS)('is different under %s', (_n, opts) => {
      expectBoth(a, b, opts, false);
    });

    it('is also different when the change is inside a nested extension period', () => {
      const c = patient();
      c.extension[0] = {
        url: c.extension[0].url,
        valuePeriod: { start: '2024-01-01', end: '2025-01-01' },
      };
      ALL_OPTIONS.forEach(([, opts]) => expectBoth(a, c, opts, false));
    });

    it('is also different when a generalPractitioner reference changes', () => {
      const c = patient();
      c.generalPractitioner[0].reference = 'Practitioner/prac-2';
      ALL_OPTIONS.forEach(([, opts]) => expectBoth(a, c, opts, false));
    });
  });

  describe('excludedProperties masking meta.lastUpdated', () => {
    const a = patient();
    const b = patient();
    b.meta.lastUpdated = '2024-06-01T00:00:00.000Z';

    it('is different without the exclusion', () => {
      ALL_OPTIONS.forEach(([, opts]) => expectBoth(a, b, opts, false));
    });
    it('is equal when root.meta.lastUpdated is excluded', () => {
      ALL_OPTIONS.forEach(([, opts]) =>
        expectBoth(
          a,
          b,
          { ...opts, excludedProperties: ['root.meta.lastUpdated'] },
          true,
        ),
      );
    });
    it('masks two changed meta fields when both are excluded', () => {
      const c = patient();
      c.meta.lastUpdated = '2024-06-01T00:00:00.000Z';
      c.meta.versionId = '4';
      const excluded = ['root.meta.lastUpdated', 'root.meta.versionId'];
      ALL_OPTIONS.forEach(([, opts]) => {
        expect(
          seriallyEquivalent(a, c, { ...opts, excludedProperties: excluded }),
        ).toBe(true);
        expect(
          referenceSeriallyEquivalent(a, c, {
            ...opts,
            excludedProperties: excluded,
          }),
        ).toBe(true);
      });
    });
    it('excluding the whole root.meta subtree also masks it', () => {
      ALL_OPTIONS.forEach(([, opts]) =>
        expectBoth(a, b, { ...opts, excludedProperties: ['root.meta'] }, true),
      );
    });
    it('a partial path (root.meta.last) does not mask anything', () => {
      ALL_OPTIONS.forEach(([, opts]) =>
        expectBoth(
          a,
          b,
          { ...opts, excludedProperties: ['root.meta.last'] },
          false,
        ),
      );
    });
    describe('an exclusion inside an array element', () => {
      // Both implementations address array elements differently depending on
      // how the array is compared: index by index, the element path carries
      // the index (root.identifier.1.value); when matched without ordering,
      // elements are compared under the ARRAY's own path, so the exclusion is
      // written without an index (root.identifier.value) and applies to every
      // element.
      const c = patient();
      c.identifier[1].value = 'MRN-999';

      it('uses the index as a segment when ordering is required', () => {
        expectBoth(
          a,
          c,
          { ...ORDERED, excludedProperties: ['root.identifier.1.value'] },
          true,
        );
        expectBoth(
          a,
          c,
          { ...ORDERED, excludedProperties: ['root.identifier.0.value'] },
          false,
        );
        expectBoth(
          a,
          c,
          { ...ORDERED, excludedProperties: ['root.identifier.value'] },
          false,
        );
      });

      it('uses the array path (no index) when ordering is not required', () => {
        for (const opts of [DEFAULT, UNORDERED, UNORDERED_ALL]) {
          expectBoth(
            a,
            c,
            { ...opts, excludedProperties: ['root.identifier.value'] },
            true,
          );
          expectBoth(
            a,
            c,
            { ...opts, excludedProperties: ['root.identifier.1.value'] },
            false,
          );
        }
      });
    });
  });

  describe('missing optional array vs empty array vs undefined', () => {
    const withTelecom = patient();
    const noTelecom: any = patient();
    delete noTelecom.telecom;
    const emptyTelecom: any = { ...patient(), telecom: [] };
    const undefinedTelecom: any = { ...patient(), telecom: undefined };

    it.each(ALL_OPTIONS)(
      'populated vs missing/empty/undefined is different under %s',
      (_n, opts) => {
        expectBoth(withTelecom, noTelecom, opts, false);
        expectBoth(withTelecom, emptyTelecom, opts, false);
        expectBoth(withTelecom, undefinedTelecom, opts, false);
      },
    );

    it.each(ALL_OPTIONS)(
      'missing vs undefined is different (key count) under %s',
      (_n, opts) => {
        expectBoth(noTelecom, undefinedTelecom, opts, false);
        expectBoth(undefinedTelecom, noTelecom, opts, false);
      },
    );

    it.each(ALL_OPTIONS)(
      'missing vs empty array is different under %s',
      (_n, opts) => {
        expectBoth(noTelecom, emptyTelecom, opts, false);
      },
    );

    it.each(ALL_OPTIONS)(
      'empty array vs undefined is different under %s',
      (_n, opts) => {
        expectBoth(emptyTelecom, undefinedTelecom, opts, false);
      },
    );

    it.each(ALL_OPTIONS)(
      'undefined vs null is EQUAL (== semantics) under %s',
      (_n, opts) => {
        const nullTelecom: any = { ...patient(), telecom: null };
        expectBoth(undefinedTelecom, nullTelecom, opts, true);
      },
    );
  });

  describe('Date vs ISO string', () => {
    const iso = '2024-05-01T10:00:00.000Z';
    const asString: any = {
      ...patient(),
      meta: { ...patient().meta, lastUpdated: iso },
    };
    const asDate: any = {
      ...patient(),
      meta: { ...patient().meta, lastUpdated: new Date(iso) },
    };
    const asOtherDate: any = {
      ...patient(),
      meta: {
        ...patient().meta,
        lastUpdated: new Date('2024-05-02T10:00:00.000Z'),
      },
    };

    it.each(ALL_OPTIONS)(
      'a Date is not equal to its ISO string under %s',
      (_n, opts) => {
        expectBoth(asString, asDate, opts, false);
        expectBoth(asDate, asString, opts, false);
      },
    );
    it.each(ALL_OPTIONS)('two Dates compare by epoch under %s', (_n, opts) => {
      expectBoth(
        asDate,
        { ...asDate, meta: { ...asDate.meta, lastUpdated: new Date(iso) } },
        opts,
        true,
      );
      expectBoth(asDate, asOtherDate, opts, false);
    });
    it.each(ALL_OPTIONS)(
      'excluding root.meta.lastUpdated masks the type difference under %s',
      (_n, opts) => {
        expectBoth(
          asString,
          asDate,
          { ...opts, excludedProperties: ['root.meta.lastUpdated'] },
          true,
        );
      },
    );
  });

  describe('KNOWN DIVERGENCE (debug message only): several properties differ at once', () => {
    // main@6622ee8 sorted object keys before comparing; the rewrite visits them
    // in insertion order. Results are identical, but when two or more sibling
    // properties differ the FIRST debug message names a different property.
    // Kept here as an explicit, visible expectation so a decision to restore
    // sorted visiting (or to accept this) flips a single test.
    const a = patient();
    const b = patient();
    b.meta.versionId = '4'; // inserted before lastUpdated
    b.meta.lastUpdated = '2024-06-01T00:00:00.000Z';

    it.each(ALL_OPTIONS)('results agree (false) under %s', (_n, opts) => {
      const { result, reference } = runBoth(a, b, opts);
      expect(result).toBe(false);
      expect(reference).toBe(false);
    });

    it('the rewrite reports the insertion-first key, the reference the sorted-first key', () => {
      const { newMsgs, refMsgs } = runBoth(a, b, DEFAULT);
      expect(newMsgs[0]).toContain(
        'Equivalence failed at root.meta.versionId ',
      );
      expect(refMsgs[0]).toContain(
        'Equivalence failed at root.meta.lastUpdated ',
      );
      expect(newMsgs).toHaveLength(1);
      expect(refMsgs).toHaveLength(1);
    });

    it('both agree exactly once keys are inserted in sorted order', () => {
      const sorted = (p: ReturnType<typeof patient>) => ({
        ...p,
        meta: {
          lastUpdated: p.meta.lastUpdated,
          source: p.meta.source,
          tag: p.meta.tag,
          versionId: p.meta.versionId,
        },
      });
      const { newMsgs, refMsgs } = runBoth(sorted(a), sorted(b), DEFAULT);
      expect(newMsgs[0]).toBe(refMsgs[0]);
      expect(newMsgs[0]).toContain('root.meta.lastUpdated');
    });
  });

  describe('JSON round-trip (what a HealthLake read hands back)', () => {
    it.each(ALL_OPTIONS)(
      'a resource equals its JSON round-trip under %s',
      (_n, opts) => {
        expectBoth(patient(), clone(patient()), opts, true);
        expectBoth(coverage(), clone(coverage()), opts, true);
      },
    );
  });
});
