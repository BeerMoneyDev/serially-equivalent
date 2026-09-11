/**
 * Differential test: the perf rewrite must return exactly what upstream `main`
 * returned, for every option combination, over thousands of generated nested
 * values (the shape a FHIR-resource change-detection service feeds it).
 *
 * The reference is a frozen copy of main @6622ee8 (src/__fixtures__). Inputs
 * come from a seeded PRNG so a failure is reproducible; set SE_DIFF_CASES to
 * raise the pair count locally (default 3000, ~a few seconds).
 */
import { seriallyEquivalent } from './serially-equivalent';
import { SeriallyEquivalentOptions } from './serially-equivalent-options.interface';
import { referenceSeriallyEquivalent } from './__fixtures__/reference-serially-equivalent';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — no dependency, fixed seed, reproducible.
// ---------------------------------------------------------------------------

const SEED = 0x5e_d1ff;
const CASES = Number(process.env.SE_DIFF_CASES) || 3000;
/**
 * The rewrite visits object keys in insertion order; main@6622ee8 sorted them
 * first. When two or more sites differ, the FIRST debug message therefore
 * names a different property (message text per failure kind is unchanged).
 * By default such a difference is accepted only if it is fully explained by
 * visit order (both implementations must agree exactly on sorted-insertion
 * clones of the same inputs). SE_DIFF_STRICT_DEBUG=1 demands byte-identical
 * first messages on the original inputs instead, which fails on those
 * multi-site cases.
 */
const STRICT_DEBUG = process.env.SE_DIFF_STRICT_DEBUG === '1';

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (rng: Rng, n: number) => Math.floor(rng() * n);
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[int(rng, xs.length)];
function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Value generation
// ---------------------------------------------------------------------------

const KEYS = [
  'id',
  'system',
  'value',
  'use',
  'code',
  'display',
  'given',
  'family',
  'line',
  'city',
  'period',
  'start',
  'end',
  'reference',
  'url',
  'meta',
  'lastUpdated',
  'status',
  'text',
  'coding',
];
const STRINGS = [
  '',
  'a',
  'b',
  'x',
  'MRN',
  'official',
  '2020-01-01',
  'Ben',
  'Sam',
];
const MAX_DEPTH = 6;

function genLeaf(rng: Rng): any {
  switch (int(rng, 14)) {
    case 0:
    case 1:
    case 2:
      return pick(rng, STRINGS);
    case 3:
      return `s${int(rng, 1000)}`;
    case 4:
    case 5:
      return int(rng, 20);
    case 6:
      return rng() * 100;
    case 7:
      return rng() < 0.5;
    case 8:
      return null;
    case 9:
      return undefined;
    case 10:
      return new Date(1_500_000_000_000 + int(rng, 5) * 86_400_000);
    case 11:
      return Buffer.from([int(rng, 3), int(rng, 3)].slice(0, int(rng, 3)));
    case 12:
      return rng() < 0.5
        ? new String(pick(rng, STRINGS))
        : new Number(int(rng, 3));
    default:
      return pick(rng, [0, -0, 1e21, -1, NaN, 'true', '0', true]);
  }
}

function genArray(rng: Rng, depth: number): any[] {
  const len = int(rng, 4); // includes empty
  const out: any[] = [];
  const kind = int(rng, 4); // 0 leaves, 1 objects, 2 arrays-of-arrays, 3 mixed
  for (let i = 0; i < len; i++) {
    if (i > 0 && rng() < 0.2) {
      out.push(clone(out[int(rng, i)])); // duplicated element
      continue;
    }
    if (kind === 0) out.push(genLeaf(rng));
    else if (kind === 1) out.push(genObject(rng, depth + 1));
    else if (kind === 2) out.push(genArray(rng, depth + 1));
    else out.push(genValue(rng, depth + 1));
  }
  if (len > 1 && rng() < 0.1) delete out[int(rng, len)]; // sparse
  return out;
}

function genObject(rng: Rng, depth: number): Record<string, any> {
  const n = int(rng, 4); // includes empty
  const keys = shuffle(rng, KEYS).slice(0, n);
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = genValue(rng, depth + 1);
  return out;
}

function genValue(rng: Rng, depth: number): any {
  if (depth >= MAX_DEPTH) return genLeaf(rng);
  // Branching probability decays with depth so values reach depth 6 without
  // exploding to thousands of nodes (keeps 3000 pairs x 32 comparisons fast).
  const branch = 0.5 * (1 - depth / MAX_DEPTH);
  const r = rng();
  if (r < branch * 0.55) return genObject(rng, depth);
  if (r < branch) return genArray(rng, depth);
  return genLeaf(rng);
}

function genRoot(rng: Rng): any {
  return rng() < 0.3 ? genArray(rng, 0) : genObject(rng, 0);
}

// ---------------------------------------------------------------------------
// Structural helpers (clone preserves holes, Dates, Buffers, boxed primitives)
// ---------------------------------------------------------------------------

function clone(v: any): any {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (Buffer.isBuffer(v)) return Buffer.from(v);
  if (v instanceof String) return new String(v.valueOf());
  if (v instanceof Number) return new Number(v.valueOf());
  if (v instanceof Boolean) return new Boolean(v.valueOf());
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) if (i in v) out[i] = clone(v[i]);
    return out;
  }
  const out: Record<string, any> = {};
  for (const k of Object.keys(v)) out[k] = clone(v[k]);
  return out;
}

const isContainer = (v: any) =>
  v !== null &&
  typeof v === 'object' &&
  !(v instanceof Date) &&
  !Buffer.isBuffer(v) &&
  !(v instanceof String) &&
  !(v instanceof Number) &&
  !(v instanceof Boolean);

function shuffleKeys(rng: Rng, v: any): any {
  if (!isContainer(v)) return v;
  if (Array.isArray(v)) return v.map((x) => shuffleKeys(rng, x));
  const out: Record<string, any> = {};
  for (const k of shuffle(rng, Object.keys(v))) out[k] = shuffleKeys(rng, v[k]);
  return out;
}

/** Every path (as key arrays) below root, with a flag for leaf vs. container. */
function paths(
  v: any,
  prefix: string[] = [],
): { path: string[]; leaf: boolean }[] {
  const out: { path: string[]; leaf: boolean }[] = [];
  if (!isContainer(v)) return out;
  for (const k of Object.keys(v)) {
    const p = [...prefix, k];
    out.push({ path: p, leaf: !isContainer(v[k]) });
    out.push(...paths(v[k], p));
  }
  return out;
}

function getAt(v: any, path: string[]): any {
  return path.reduce((acc, k) => acc[k], v);
}
function setAt(v: any, path: string[], value: any): void {
  getAt(v, path.slice(0, -1))[path[path.length - 1]] = value;
}

/** Clone with every object's keys inserted in sorted order (arrays untouched). */
function sortedInsertion(v: any): any {
  if (!isContainer(v)) return clone(v);
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++)
      if (i in v) out[i] = sortedInsertion(v[i]);
    return out;
  }
  const out: Record<string, any> = {};
  for (const k of Object.keys(v).sort()) out[k] = sortedInsertion(v[k]);
  return out;
}

function containsArrayInArray(v: any): boolean {
  if (!isContainer(v)) return false;
  if (Array.isArray(v)) {
    return v.some((x) => Array.isArray(x) || containsArrayInArray(x));
  }
  return Object.keys(v).some((k) => containsArrayInArray(v[k]));
}

// ---------------------------------------------------------------------------
// Pair generation: b is derived from a by one of these transformations.
// ---------------------------------------------------------------------------

const MUTATIONS = [
  'identical',
  'shuffledKeys',
  'leafMutated',
  'arrayPermuted',
  'elementRemovedOrAdded',
  'missingVsUndefined',
] as const;
type Mutation = (typeof MUTATIONS)[number];

interface Pair {
  a: any;
  b: any;
  mutation: Mutation;
  /** All `root.…` paths of a, for excludedProperties (computed once). */
  aPaths: string[];
  /** Whether either side nests an array directly inside an array. */
  arrayInArray: boolean;
}

/**
 * Apply `mutation` to b in place (or return a replacement root). Returns false
 * when the value offered no target for that mutation (e.g. no arrays to
 * permute), so the caller can fall back to a mutation that always applies.
 */
function applyMutation(
  rng: Rng,
  mutation: Mutation,
  b: any,
): { b: any; applied: boolean } {
  const all = paths(b);
  switch (mutation) {
    case 'identical':
      return { b, applied: true };
    case 'shuffledKeys':
      return { b: shuffleKeys(rng, b), applied: true };
    case 'leafMutated': {
      const leaves = all.filter((p) => p.leaf);
      if (!leaves.length) {
        // No leaf to change: add one at the root instead (still "one site changed").
        if (Array.isArray(b)) b.push(genLeaf(rng));
        else b.mutated = genLeaf(rng);
        return { b, applied: true };
      }
      const { path } = pick(rng, leaves);
      const before = getAt(b, path);
      let after = genLeaf(rng);
      // Make sure the replacement is actually a different value.
      for (
        let tries = 0;
        tries < 5 && referenceSeriallyEquivalent(before, after);
        tries++
      ) {
        after = genLeaf(rng);
      }
      setAt(b, path, after);
      return { b, applied: true };
    }
    case 'arrayPermuted': {
      const arrays = [
        ...(Array.isArray(b) && b.length > 1 ? [{ path: [] as string[] }] : []),
        ...all.filter(
          (p) => Array.isArray(getAt(b, p.path)) && getAt(b, p.path).length > 1,
        ),
      ];
      if (!arrays.length) return { b, applied: false };
      const { path } = pick(rng, arrays);
      const permuted = shuffle(rng, Array.from(getAt(b, path)));
      if (path.length === 0) return { b: permuted, applied: true };
      setAt(b, path, permuted);
      return { b, applied: true };
    }
    case 'elementRemovedOrAdded': {
      const arrays = [
        ...(Array.isArray(b) ? [{ path: [] as string[] }] : []),
        ...all.filter((p) => Array.isArray(getAt(b, p.path))),
      ];
      if (!arrays.length) return { b, applied: false };
      const arr: any[] = getAt(b, pick(rng, arrays).path);
      if (arr.length && rng() < 0.5) arr.splice(int(rng, arr.length), 1);
      else arr.push(genLeaf(rng));
      return { b, applied: true };
    }
    case 'missingVsUndefined': {
      const objKeys = all.filter((p) => {
        const parent = getAt(b, p.path.slice(0, -1));
        return isContainer(parent) && !Array.isArray(parent);
      });
      if (!objKeys.length) return { b, applied: false };
      const { path } = pick(rng, objKeys);
      if (rng() < 0.5) setAt(b, path, undefined);
      else delete getAt(b, path.slice(0, -1))[path[path.length - 1]];
      return { b, applied: true };
    }
  }
}

function makePair(rng: Rng): Pair {
  const a = genRoot(rng);
  let mutation = pick(rng, MUTATIONS);
  let result = applyMutation(rng, mutation, clone(a));
  if (!result.applied) {
    // Fall back to a mutation that always applies, so the false/true mix stays
    // representative even for tiny generated values.
    mutation = 'leafMutated';
    result = applyMutation(rng, mutation, clone(a));
  }
  return {
    a,
    b: result.b,
    mutation,
    aPaths: paths(a).map((p) => ['root', ...p.path].join('.')),
    arrayInArray: containsArrayInArray(a) || containsArrayInArray(result.b),
  };
}

// ---------------------------------------------------------------------------
// Option sets
// ---------------------------------------------------------------------------

const BASE_OPTIONS: { name: string; opts: SeriallyEquivalentOptions }[] = [
  { name: '{}', opts: {} },
  { name: '{requireArrayOrdering:true}', opts: { requireArrayOrdering: true } },
  {
    name: '{requireArrayOrdering:false}',
    opts: { requireArrayOrdering: false },
  },
  {
    name: "{requireArrayOrdering:false, arrayOrderingScope:'all'}",
    opts: { requireArrayOrdering: false, arrayOrderingScope: 'all' },
  },
];

function randomExcluded(rng: Rng, aPaths: string[]): string[] {
  if (!aPaths.length) return ['root.nothing'];
  const n = 1 + int(rng, 2);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pick(rng, aPaths));
  return out;
}

function runBoth(
  a: any,
  b: any,
  opts: SeriallyEquivalentOptions,
  withDebug: boolean,
) {
  const newMsgs: string[] = [];
  const refMsgs: string[] = [];
  const newOpts = withDebug
    ? { ...opts, debug: (m: string) => newMsgs.push(m) }
    : { ...opts };
  const refOpts = withDebug
    ? { ...opts, debug: (m: string) => refMsgs.push(m) }
    : { ...opts };
  const result = seriallyEquivalent(a, b, newOpts);
  const reference = referenceSeriallyEquivalent(a, b, refOpts);
  return { result, reference, newMsgs, refMsgs };
}

function describeCase(
  i: number,
  mutation: Mutation,
  a: any,
  b: any,
  opts: unknown,
): string {
  const show = (v: any) =>
    JSON.stringify(v, (_k, x) =>
      Buffer.isBuffer(x)
        ? `Buffer(${[...x]})`
        : x instanceof String || x instanceof Number
        ? `boxed(${x.valueOf()})`
        : x === undefined
        ? '__undefined__'
        : typeof x === 'number' && !isFinite(x)
        ? String(x)
        : x,
    );
  return `case #${i} (${mutation}) options=${JSON.stringify(opts)}\n  a=${show(
    a,
  )}\n  b=${show(b)}`;
}

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------

describe('differential: perf rewrite vs frozen main@6622ee8', () => {
  const rng = mulberry32(SEED);
  const pairs = Array.from({ length: CASES }, () => makePair(rng));

  // Variants exercised per option set: the no-debug/no-excluded fast path
  // (the rewrite skips path building there), debug alone, excludedProperties
  // alone, and both together.
  const variants = [
    { name: 'plain', excluded: false, debug: false },
    { name: 'debug', excluded: false, debug: true },
    { name: 'excluded', excluded: true, debug: false },
    { name: 'excluded+debug', excluded: true, debug: true },
  ];

  const tally: Record<string, { t: number; f: number; msgOrderOnly: number }> =
    {};
  const messageDivergences: string[] = [];

  for (const { name, opts } of BASE_OPTIONS) {
    it(`agrees with the reference under ${name} (${CASES} pairs x ${variants.length} variants)`, () => {
      const counts = { t: 0, f: 0, msgOrderOnly: 0 };
      const isAllScope = opts.arrayOrderingScope === 'all';
      pairs.forEach(({ a, b, mutation, aPaths, arrayInArray }, i) => {
        for (const v of variants) {
          const excluded = v.excluded ? randomExcluded(rng, aPaths) : undefined;
          const caseOpts: SeriallyEquivalentOptions = excluded
            ? { ...opts, excludedProperties: excluded }
            : { ...opts };
          const { result, reference, newMsgs, refMsgs } = runBoth(
            a,
            b,
            caseOpts,
            v.debug,
          );
          const label = () =>
            describeCase(i, mutation, a, b, { ...caseOpts, variant: v.name });

          // 1. Same boolean, same options, on the same inputs. main@6622ee8
          //    already carries arrayOrderingScope (PR #2), so this holds for
          //    the 'all' set as well.
          if (result !== reference) {
            throw new Error(
              `RESULT DIVERGENCE new=${result} reference=${reference}\n${label()}`,
            );
          }

          // 2. Documented equivalence for the 'all' scope: a bare root array
          //    behaves like a property array, i.e. comparing {v:a} to {v:b}
          //    under plain {requireArrayOrdering:false}. This only covers the
          //    root level — arrays nested directly inside arrays are still
          //    ordered under the default scope — so it is checked only for
          //    inputs without array-in-array nesting.
          if (isAllScope && !arrayInArray) {
            const wrappedExcluded = excluded?.map((p) =>
              p.replace(/^root/, 'root.v'),
            );
            const wrapped = referenceSeriallyEquivalent(
              { v: a },
              { v: b },
              wrappedExcluded
                ? {
                    requireArrayOrdering: false,
                    excludedProperties: wrappedExcluded,
                  }
                : { requireArrayOrdering: false },
            );
            if (result !== wrapped) {
              throw new Error(
                `'all' SCOPE != wrapped-root reference: new=${result} wrapped=${wrapped}\n${label()}`,
              );
            }
          }

          // 3. Debug: a false result must have logged in both, and the first
          //    message (the failure that decided the result) must be identical.
          if (v.debug) {
            if (result === false) {
              if (newMsgs.length === 0 || refMsgs.length === 0) {
                throw new Error(
                  `debug not invoked on false result: new=${
                    newMsgs.length
                  } reference=${refMsgs.length}\n${label()}`,
                );
              }
              if (newMsgs[0] !== refMsgs[0]) {
                // Explained by key-visit order iff, on clones whose keys are
                // inserted in sorted order (so insertion order == sorted order
                // and the two visit orders coincide), both implementations
                // produce the identical first message. Arrays keep their index
                // order, so the reference's "10" < "2" string sort of indices
                // would still surface here as unexplained.
                const sa = sortedInsertion(a);
                const sb = sortedInsertion(b);
                const sorted = runBoth(sa, sb, caseOpts, true);
                const explained =
                  sorted.newMsgs.length > 0 &&
                  sorted.newMsgs[0] === sorted.refMsgs[0];
                if (explained && !STRICT_DEBUG) {
                  counts.msgOrderOnly++;
                } else {
                  messageDivergences.push(
                    `${label()}\n  new: ${JSON.stringify(
                      newMsgs[0],
                    )}\n  ref: ${JSON.stringify(
                      refMsgs[0],
                    )}\n  explained by key visit order: ${explained}`,
                  );
                }
              }
            } else if (newMsgs.length || refMsgs.length) {
              throw new Error(
                `debug invoked on true result: new=${
                  newMsgs.length
                } reference=${refMsgs.length}\n${label()}`,
              );
            }
          }

          if (result) counts.t++;
          else counts.f++;
        }
      });
      tally[name] = counts;

      const total = counts.t + counts.f;
      // Visibly non-trivial: both outcomes must be well represented.
      expect(counts.t / total).toBeGreaterThanOrEqual(0.3);
      expect(counts.f / total).toBeGreaterThanOrEqual(0.3);
    });
  }

  it(`produces identical first debug messages wherever the result is false${
    STRICT_DEBUG ? ' (strict)' : ' (modulo key visit order)'
  }`, () => {
    if (messageDivergences.length) {
      throw new Error(
        `${
          messageDivergences.length
        } first-debug-message divergence(s); first 5:\n\n${messageDivergences
          .slice(0, 5)
          .join('\n\n')}`,
      );
    }
  });

  afterAll(() => {
    const summary = Object.entries(tally)
      .map(
        ([k, { t, f, msgOrderOnly }]) =>
          `${k}: true=${t} false=${f} firstDebugMsgDiffersByKeyOrderOnly=${msgOrderOnly}`,
      )
      .join(' | ');
    // eslint-disable-next-line no-console
    console.log(
      `[differential] seed=0x${SEED.toString(16)} pairs=${CASES} — ${summary}`,
    );
  });
});
