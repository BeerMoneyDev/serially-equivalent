import { SeriallyEquivalentOptions } from './serially-equivalent-options.interface';
import whichBoxedPrimitive from 'which-boxed-primitive';
import isDate from 'is-date-object';

function objectEquivalence<T>(
  a: T,
  b: T,
  propertyPath: string,
  shouldLog: boolean,
  options?: SeriallyEquivalentOptions,
): boolean {
  // Handle typeof mismatch
  if (typeof a !== typeof b) {
    logNoMatch(
      propertyPath,
      shouldLog,
      options,
      `TypeOf mismatch...
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
      options,
      `Array check mismatch...
      isArray actual : ${Array.isArray(a)}
      isArray expected: ${Array.isArray(b)}`,
    );
    return false;
  }
  // Handle Date Objects
  if (isDate(a) !== isDate(b)) {
    logNoMatch(
      propertyPath,
      shouldLog,
      options,
      `Date type mismatch...
      isDate actual: ${isDate(a)}
      isDate expected: ${isDate(b)}`,
    );
    return false;
  }

  if (isActualDate(a) && isActualDate(b)) {
    if (a.getTime() !== b.getTime()) {
      logNoMatch(
        propertyPath,
        shouldLog,
        options,
        `Date value mismatch...
      epochTime actual: ${a.getTime()}
      epochTime expected: ${b.getTime()}`,
      );
      return false;
    }
  }

  // Handle Buffer Objects
  const aIsBuffer = isBuffer(a);
  const bIsBuffer = isBuffer(b);
  if (aIsBuffer !== bIsBuffer) {
    logNoMatch(
      propertyPath,
      shouldLog,
      options,
      `isBuffer mismatch mismatch...
      isBuffer actual: ${aIsBuffer}
      isBuffer expected: ${bIsBuffer}`,
    );
    return false;
  }
  if (isBuffer(a) && isBuffer(b)) {
    if (a.length !== b.length) {
      logNoMatch(
        propertyPath,
        shouldLog,
        options,
        `Buffer length mismatch...
        Buffer length actual: ${a.length}
        Buffer length expected: ${b.length}`,
      );
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        logNoMatch(
          propertyPath,
          shouldLog,
          options,
          `Buffer value mismatch at position ${i}...
          Buffer value at ${i} actual: ${a[i]}
          Buffer value at ${i} expected: ${b[i]}`,
        );
        return false;
      }
    }
    return true;
  }

  // Iterate through Objects' keys!
  // Sets, Maps, RegExp serialize as empty objects through JSON.stringify().
  // The fact that they don't expose their keys will cause them to return true!
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    logNoMatch(
      propertyPath,
      shouldLog,
      options,
      `Object keys length mismatch...
      keys length actual: ${keysA.length}
      keys length expected: ${keysB.length}
      keys actual: ${keysA.join(',')}
      keys expected: ${keysB.join(',')}`,
    );
    return false;
  }
  keysA.sort();
  keysB.sort();
  for (const key of keysA) {
    const propA = a[key];
    const propB = b[key];
    const expandedPath = `${propertyPath}.${key}`;
    if (
      !options?.requireArrayOrdering &&
      isActualArray(propA) &&
      isActualArray(propB)
    ) {
      if (propA.length !== propB.length) {
        logNoMatch(
          expandedPath,
          shouldLog,
          options,
          `Array length mismatch...
          length actual: ${propA.length}
          length expected: ${propB.length}`,
        );
        return false;
      }
      if (
        !propA.every((x) =>
          propB.some((y) =>
            internalSeriallyEquivalent(y, x, expandedPath, false, options),
          ),
        )
      ) {
        logNoMatch(
          expandedPath,
          shouldLog,
          options,
          `Array ignore ordering no matching element`,
        );
        return false;
      }
    } else {
      if (
        !internalSeriallyEquivalent(
          propA,
          propB,
          expandedPath,
          shouldLog,
          options,
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

function isActualDate(a: any): a is Date {
  return isDate(a);
}
function isActualArray(a: any): a is Array<any> {
  return Array.isArray(a);
}

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

function internalSeriallyEquivalent<T>(
  actual: T,
  expected: T,
  propertyPath: string,
  shouldLog: boolean,
  options?: SeriallyEquivalentOptions,
): boolean {
  const opts = options || {};
  if (actual === expected) {
    return true;
  }

  if (isExcludedProperty(propertyPath, opts)) {
    return true;
  }

  // We don't serialize functions and symbols are hidden so who cares.
  if (typeof expected === 'function' || typeof expected === 'symbol') {
    return true;
  }

  const actualBoxed = whichBoxedPrimitive(actual);
  const expectedBoxed = whichBoxedPrimitive(expected);
  if (actualBoxed !== expectedBoxed) {
    logNoMatch(
      propertyPath,
      shouldLog,
      opts,
      `WhichBoxedPrimitive mismatch
      primitive box actual: ${actualBoxed}
      primitive box expected: ${expectedBoxed}`,
    );
    return false;
  }

  // 7.3. Other pairs that do not both pass typeof value == 'object', equivalence is determined by ==.
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
        opts,
        `Actual not equal to expected. One may not be truthy...
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

  return objectEquivalence<T>(actual, expected, propertyPath, shouldLog, opts);
}

/**
 * Log the no-match based on user provided debug function
 * @param propertyPath
 * @param opts
 */
function logNoMatch(
  propertyPath: string,
  shouldLog: boolean,
  opts: SeriallyEquivalentOptions,
  issue: string,
) {
  if (!!opts.debug && shouldLog) {
    opts.debug(`Equivalence failed at ${propertyPath} for issue: ${issue}`);
  }
}

function isExcludedProperty(
  propertyPath: string,
  opts: SeriallyEquivalentOptions,
): boolean {
  if (!opts.excludedProperties) {
    return false;
  }
  const inContextPropSplits = propertyPath.split('.');
  for (const exclProp of opts.excludedProperties) {
    const exclSplits = exclProp.split('.');
    if (inContextPropSplits.length !== exclSplits.length) {
      continue;
    }
    if (
      inContextPropSplits.every((x: string, i: number) => {
        const exclSplitVal = exclSplits[i];
        return x === exclSplitVal;
      })
    ) {
      return true;
    }
  }
  return false;
}

/**
 * serialEquals is a by value deep equivalence function.
 * The author finds By reference comparison untenable for many data-centric use cases.
 * That said, this is very derivatinve of deepEquals.
 * @param a the "actual object" you are comparing with
 * @param b the "expected object" you are comparing against.
 * @param options the options you specify for the comparison
 */
export function seriallyEquivalent<T = any>(
  a: T,
  b: T,
  options?: SeriallyEquivalentOptions,
): boolean {
  return internalSeriallyEquivalent<T>(a, b, 'root', true, options);
}
