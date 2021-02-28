import deepEqual from 'deep-equal';
import { seriallyEquivalent } from './serially-equivalent';

describe('serially-equivalent', () => {
  let actual: TestObject;
  let expected: TestObject;
  it('should agree on primatives', () => {
    actual = null;
    expected = null;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );

    actual = 'hello' as any;
    expected = 'hello' as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );

    actual = 'hello' as any;
    expected = 'helloYou' as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );

    actual = 213 as any;
    expected = 213 as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );

    actual = 213 as any;
    expected = 214 as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });
  it('should agree on Boxed primatives', () => {
    actual = new String('hello') as any;
    expected = new Number(423) as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });
  it('should say false comparing objects to other types', () => {
    actual = ((x: number) => x * x) as any;
    expected = { subObj: {} };
    expect(
      seriallyEquivalent<TestObject>(actual, expected, {
        debug: (msg: string) => {
          console.warn(msg);
        },
      }),
    ).toBeFalsy();
  });
  it('should handle buffers compared to other things', () => {
    actual = Buffer.from('hello') as any;
    expected = { subObj: {} };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
  });
  it('should handle buffers of different lengths', () => {
    actual = Buffer.from('hello') as any;
    expected = Buffer.from('helloYou') as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
  });
  it('should handle buffers of same length different values', () => {
    actual = Buffer.from('hello') as any;
    expected = Buffer.from('cards') as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
  });
  it('should treat identical buffers as the same', () => {
    actual = Buffer.from('hello') as any;
    expected = Buffer.from('hello') as any;

    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
  });
  it('should agree on Dates', () => {
    actual = new Date('2020-01-01') as any;
    expected = new Date('2020-01-01') as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );

    actual = new Date('2020-01-01') as any;
    expected = new Date('2020-02-01') as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );

    actual = new Date('2020-01-01') as any;
    expected = {} as any;
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });
  it('should agree with sub-object with empty sub-properties', () => {
    actual = {
      subObj: {},
    };
    expected = {
      subObj: {},
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should agree with sub-object with null subproperty', () => {
    actual = {
      subObj: null,
    };
    expected = {
      subObj: null,
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should agree with sub-object with undefined subproperty', () => {
    actual = {
      subObj: undefined,
    };
    expected = {
      subObj: undefined,
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should agree on sub-object with string sub-properties', () => {
    actual = {
      subObj: {
        str: 'hi',
      },
    };
    expected = {
      subObj: {
        str: 'hi',
      },
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should agree on sub-object with string + num sub-properties', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
      },
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });
  it('should disagree on sub-object with function. We say the true. They say false', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
        func: () => null,
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
        func: () => null,
      },
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).not.toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should agree on sub-object with Dates.', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
        date: new Date('2021-01-01'),
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
        date: new Date('2021-01-01'),
      },
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should agree on sub-object with array.', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'jon' }, { num: 42 }],
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'jon' }, { num: 42 }],
      },
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should not agree on sub-object with array, when array order disabled', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'jon' }, { str: 'belushi' }],
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'belushi' }, { str: 'jon' }],
      },
    };
    expect(
      seriallyEquivalent<TestObject>(actual, expected, {
        requireArrayOrdering: false,
      }),
    ).toBeTruthy();
    expect(deepEqual(actual, expected)).not.toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should agree on sub-object with array, when array order disabled but truly no match', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'jon' }, { str: 'belushi' }],
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'belushi', num: 422 }, { str: 'jon' }],
      },
    };
    expect(
      seriallyEquivalent<TestObject>(actual, expected, {
        requireArrayOrdering: false,
      }),
    ).toBeFalsy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected, {
        requireArrayOrdering: false,
      }),
    );
  });

  it('should agree on sub-object with array, when array order disabled, but array length different', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'jon' }, { str: 'belushi' }, { str: '2' }],
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'belushi' }, { str: 'jon' }],
      },
    };
    expect(
      seriallyEquivalent<TestObject>(actual, expected, {
        requireArrayOrdering: false,
      }),
    ).toBeFalsy();
    expect(deepEqual(actual, expected)).toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should not agree on sub-object with array of objects with function.', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'jon', func: () => null }],
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 43,
        arr: [{ str: 'jon', func: () => null }],
      },
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeTruthy();
    expect(deepEqual(actual, expected)).not.toEqual(
      seriallyEquivalent<TestObject>(actual, expected),
    );
  });

  it('should return false when subproperties dont have the same number of keys.', () => {
    actual = {
      subObj: {
        str: 'hi',
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 42,
      },
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
  });

  it('should return false when subproperties both objects but one is an array and one is not.', () => {
    actual = {
      subObj: {
        str: 'hi',
      },
    };
    expected = {
      subObj: [] as any,
    };
    expect(seriallyEquivalent<TestObject>(actual, expected)).toBeFalsy();
  });
  it('should return true when the only difference is an excluded property', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 42,
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 87,
      },
    };
    expect(
      seriallyEquivalent<TestObject>(actual, expected, {
        excludedProperties: ['root.subObj.num'],
      }),
    ).toBeTruthy();
    expect(deepEqual(actual, expected)).toBeFalsy();
  });
  it('should return true when the only difference is an excluded property and that excluded property is in an array', () => {
    actual = {
      subObj: {
        str: 'hi',
        num: 42,
        arr: [
          {
            str: 'boo',
          },
          {
            str: 'you',
            num: 61,
          },
        ],
      },
    };
    expected = {
      subObj: {
        str: 'hi',
        num: 42,
        arr: [
          {
            str: 'boo',
          },
          {
            str: 'you',
            num: 12,
          },
        ],
      },
    };
    expect(
      seriallyEquivalent<TestObject>(actual, expected, {
        debug: (msg: string) => {
          console.warn(msg);
        },
        excludedProperties: ['root.subObj.arr.num'],
      }),
    ).toBeTruthy();
    expect(deepEqual(actual, expected)).toBeFalsy();
  });
});

interface TestObject {
  subObj: TestSubObject;
}

interface TestSubObject {
  str?: string;
  num?: number;
  func?: () => any;
  arr?: TestSubObject[];
  date?: Date;
}
