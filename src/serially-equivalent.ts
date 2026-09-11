import { SeriallyEquivalentOptions } from './serially-equivalent-options.interface';
import whichBoxedPrimitive from 'which-boxed-primitive';
import isDate from 'is-date-object';

/**
 * Internal context object normalised once at the public entry point and
 * threaded through every recursive call.  Avoids re-creating `opts || {}`
 * on every invocation and pre-computes values that are used on every node.
 */
interface Context {
  /** Whether path strings actually need to be built (only when debug or excludedProperties is active). */
  needsPath: boolean;
  requireArrayOrdering: boolean;
  /** Which arrays the unordered comparison applies to when ordering is not required. */
  arrayOrderingScope: 'properties' | 'all';
  debug?: (msg: string) => void;
  /** Pre-split excluded-property paths; null when none are configured. */
  excludedSplits: string[][] | null;
}

function buildContext(options?: SeriallyEquivalentOptions): Context {
  const debug = options?.debug;
  const excluded = options?.excludedProperties;
  return {
    needsPath: !!(debug || excluded?.length),
    // Original semantics: undefined / false → unordered (!!undefined === false).
    // The option is named "require" ordering, so true means "must be ordered".
    requireArrayOrdering: !!options?.requireArrayOrdering,
    arrayOrderingScope: options?.arrayOrderingScope ?? 'properties',
    debug,
    excludedSplits: excluded?.length ? excluded.map((e) => e.split('.')) : null,
  };
}

// ---------------------------------------------------------------------------
// Helper guards
// ---------------------------------------------------------------------------

function isBuffer(x: any): x is Buffer {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') {
    return false;
  }
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') {
    return false;
  }
  return !!(
    x.constructor &&
    x.constructor.isBuffer &&
    x.constructor.isBuffer(x)
  );
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log the no-match based on user provided debug function.
 * The message is provided as a thunk so the template literal is never
 * evaluated when debug is not configured.
 */
function logNoMatch(
  propertyPath: string,
  shouldLog: boolean,
  ctx: Context,
  getMessage: () => string,
) {
  if (ctx.debug && shouldLog) {
    ctx.debug(
      `Equivalence failed at ${propertyPath} for issue: ${getMessage()}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Excluded-property check (uses pre-split arrays from Context)
// ---------------------------------------------------------------------------

function isExcludedProperty(pathSegments: string[], ctx: Context): boolean {
  if (!ctx.excludedSplits) {
    return false;
  }
  const len = pathSegments.length;
  for (const exclSplits of ctx.excludedSplits) {
    if (exclSplits.length !== len) {
      continue;
    }
    let match = true;
    for (let i = 0; i < len; i++) {
      if (pathSegments[i] !== exclSplits[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Unordered array comparison
// ---------------------------------------------------------------------------

/**
 * Compare two arrays ignoring element order: same length, and every element of
 * `a` has its own (not already matched) equivalent element in `b`.
 *
 * Used for array-valued properties whenever ordering is not required, and for
 * the root value / arrays nested inside arrays when `arrayOrderingScope: 'all'`.
 */
function unorderedArraysEquivalent(
  a: Array<any>,
  b: Array<any>,
  propertyPath: string,
  pathSegments: string[],
  shouldLog: boolean,
  ctx: Context,
): boolean {
  if (a.length !== b.length) {
    logNoMatch(
      propertyPath,
      shouldLog,
      ctx,
      () => `Array length mismatch...
          length actual: ${a.length}
          length expected: ${b.length}`,
    );
    return false;
  }

  // Track which b-elements have already been matched so that duplicate values
  // in a (e.g. [x, x]) don't wrongly match distinct elements in b (e.g. [x, y]).
  const used = new Array<boolean>(b.length).fill(false);
  const allMatch = a.every((x) => {
    const idx = b.findIndex(
      (y, i) =>
        !used[i] &&
        internalSeriallyEquivalent(
          y,
          x,
          propertyPath,
          pathSegments,
          false,
          ctx,
        ),
    );
    if (idx === -1) return false;
    used[idx] = true;
    return true;
  });

  if (!allMatch) {
    logNoMatch(
      propertyPath,
      shouldLog,
      ctx,
      () => `Array ignore ordering no matching element`,
    );
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Core comparison
// ---------------------------------------------------------------------------

function objectEquivalence<T>(
  a: T,
  b: T,
  propertyPath: string,
  pathSegments: string[],
  shouldLog: boolean,
  ctx: Context,
): boolean {
  // Handle typeof mismatch
  if (typeof a !== typeof b) {
    logNoMatch(
      propertyPath,
      shouldLog,
      ctx,
      () => `TypeOf mismatch...
    typeof actual: ${typeof a}
    typeof expected: ${typeof b}`,
    );
    return false;
  }

  // Handle Array Objects
  if (Array.isArray(a) !== Array.isArray(b)) {
    logNoMatch(
      propertyPath,
      shouldLog,
      ctx,
      () => `Array check mismatch...
      isArray actual : ${Array.isArray(a)}
      isArray expected: ${Array.isArray(b)}`,
    );
    return false;
  }

  // Root arrays and arrays nested inside arrays never reach the key loop below
  // as properties, so the unordered comparison is applied here when requested.
  if (
    ctx.arrayOrderingScope === 'all' &&
    !ctx.requireArrayOrdering &&
    Array.isArray(a) &&
    Array.isArray(b)
  ) {
    return unorderedArraysEquivalent(
      a,
      b,
      propertyPath,
      pathSegments,
      shouldLog,
      ctx,
    );
  }

  // Handle Date Objects — cache results to avoid repeated calls
  const aIsDate = isDate(a);
  const bIsDate = isDate(b);
  if (aIsDate !== bIsDate) {
    logNoMatch(
      propertyPath,
      shouldLog,
      ctx,
      () => `Date type mismatch...
      isDate actual: ${aIsDate}
      isDate expected: ${bIsDate}`,
    );
    return false;
  }

  if (aIsDate && bIsDate) {
    // Both are dates (we already checked they agree on isDate)
    const aDate = a as unknown as Date;
    const bDate = b as unknown as Date;
    if (aDate.getTime() !== bDate.getTime()) {
      logNoMatch(
        propertyPath,
        shouldLog,
        ctx,
        () => `Date value mismatch...
      epochTime actual: ${aDate.getTime()}
      epochTime expected: ${bDate.getTime()}`,
      );
      return false;
    }
  }

  // Handle Buffer Objects — cache results; reuse cached values instead of
  // calling isBuffer(a) / isBuffer(b) a second time.
  const aIsBuffer = isBuffer(a);
  const bIsBuffer = isBuffer(b);
  if (aIsBuffer !== bIsBuffer) {
    logNoMatch(
      propertyPath,
      shouldLog,
      ctx,
      () => `isBuffer mismatch mismatch...
      isBuffer actual: ${aIsBuffer}
      isBuffer expected: ${bIsBuffer}`,
    );
    return false;
  }
  if (aIsBuffer && bIsBuffer) {
    const aBuf = a as unknown as Buffer;
    const bBuf = b as unknown as Buffer;
    if (aBuf.length !== bBuf.length) {
      logNoMatch(
        propertyPath,
        shouldLog,
        ctx,
        () => `Buffer length mismatch...
        Buffer length actual: ${aBuf.length}
        Buffer length expected: ${bBuf.length}`,
      );
      return false;
    }
    for (let i = 0; i < aBuf.length; i++) {
      if (aBuf[i] !== bBuf[i]) {
        logNoMatch(
          propertyPath,
          shouldLog,
          ctx,
          () => `Buffer value mismatch at position ${i}...
          Buffer value at ${i} actual: ${aBuf[i]}
          Buffer value at ${i} expected: ${bBuf[i]}`,
        );
        return false;
      }
    }
    return true;
  }

  // Iterate through Objects' keys.
  // Sets, Maps, RegExp serialize as empty objects through JSON.stringify().
  // The fact that they don't expose their keys will cause them to return true.
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    logNoMatch(
      propertyPath,
      shouldLog,
      ctx,
      () => `Object keys length mismatch...
      keys length actual: ${keysA.length}
      keys length expected: ${keysB.length}
      keys actual: ${keysA.join(',')}
      keys expected: ${keysB.join(',')}`,
    );
    return false;
  }

  // Sorting keysA/keysB is unnecessary: the loop looks up b[key] by name, so
  // iteration order is irrelevant to the result.  keysB is not read after this
  // point at all.  Both sorts have been removed.

  for (const key of keysA) {
    const propA = a[key];
    const propB = b[key];

    // Only build the path string when it will actually be consumed (debug or
    // excludedProperties).  This is the single biggest performance win.
    const expandedPath = ctx.needsPath ? `${propertyPath}.${key}` : '';
    const expandedSegments = ctx.needsPath
      ? [...pathSegments, key]
      : pathSegments;

    if (
      !ctx.requireArrayOrdering &&
      Array.isArray(propA) &&
      Array.isArray(propB)
    ) {
      if (
        !unorderedArraysEquivalent(
          propA,
          propB,
          expandedPath,
          expandedSegments,
          shouldLog,
          ctx,
        )
      ) {
        return false;
      }
    } else {
      if (
        !internalSeriallyEquivalent(
          propA,
          propB,
          expandedPath,
          expandedSegments,
          shouldLog,
          ctx,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function internalSeriallyEquivalent<T>(
  actual: T,
  expected: T,
  propertyPath: string,
  pathSegments: string[],
  shouldLog: boolean,
  ctx: Context,
): boolean {
  if (actual === expected) {
    return true;
  }

  if (ctx.excludedSplits && isExcludedProperty(pathSegments, ctx)) {
    return true;
  }

  // We don't serialize functions and symbols are hidden so who cares.
  if (typeof expected === 'function' || typeof expected === 'symbol') {
    return true;
  }

  // Guard whichBoxedPrimitive behind an object check: boxed primitives ARE
  // objects, so we never miss them.  For plain number/string/boolean this
  // call always returned null anyway — skipping it avoids the overhead on
  // essentially every leaf value.
  if (typeof actual === 'object' || typeof expected === 'object') {
    const actualBoxed = whichBoxedPrimitive(actual);
    const expectedBoxed = whichBoxedPrimitive(expected);
    if (actualBoxed !== expectedBoxed) {
      logNoMatch(
        propertyPath,
        shouldLog,
        ctx,
        () => `WhichBoxedPrimitive mismatch
      primitive box actual: ${actualBoxed}
      primitive box expected: ${expectedBoxed}`,
      );
      return false;
    }
  }

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  if (
    !actual ||
    !expected ||
    (typeof actual !== 'object' && typeof expected !== 'object')
  ) {
    const matched = actual == expected;
    if (!matched) {
      logNoMatch(
        propertyPath,
        shouldLog,
        ctx,
        () => `Actual not equal to expected. One may not be truthy...
        truthy status actual: ${!!actual}
        truthy status expected: ${!!expected}. 
        Or both do not have typeof object and unmatched values...
        typof actual: ${typeof actual}
        typeof expected: ${typeof expected}
        value actual: ${actual ?? 'unknown'}
        value expected: ${expected ?? 'unknown'}`,
      );
    }
    return matched;
  }

  return objectEquivalence<T>(
    actual,
    expected,
    propertyPath,
    pathSegments,
    shouldLog,
    ctx,
  );
}

/**
 * serialEquals is a by value deep equivalence function.
 * The author finds By reference comparison untenable for many data-centric use cases.
 * That said, this is very derivative of deepEquals.
 * @param a the "actual object" you are comparing with
 * @param b the "expected object" you are comparing against.
 * @param options the options you specify for the comparison
 */
export function seriallyEquivalent<T = any>(
  a: T,
  b: T,
  options?: SeriallyEquivalentOptions,
): boolean {
  const ctx = buildContext(options);
  return internalSeriallyEquivalent<T>(a, b, 'root', ['root'], true, ctx);
}
