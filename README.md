# SeriallyEquivalent


### Purpose

SeriallyEquivalent is a equivalence function derivative of [deep-equal](https://github.com/inspect-js/node-deep-equal/). It exists to compare objects as they would be expressed serially, outside the memory of a given application. SeriallyEquivalent ignore functions and Symbols and types that aren't intended to serialize through `JSON.stringify()`.
It provides options for excluding array ordering. If the length of the arrays are the same, and all elements have a serially equivalent "partner" then it will return true, ignoring the order. You can exclude properties by name if that is requried in your usecase (See examples below).  Most importantly, you can inject your own logging function to determine where two objects are failing their equivalence checks.
<br/>
<br/>

### Usage

This library can be useful for people to determine if changes have been made in an object as it would be expressed outside your application.
What does it matter to out-of-process consumers that a function is defined on one object and not another?

```ts
import { seriallyEquivalent } from 'serially-equivalent';
import deepEqual from 'deep-equal';

const a = {
    name: 'Ben',
    age: 33,
    isFun: () => false,
};

const b = {
    name: 'Ben',
    age: 33,
};
assert.equal(seriallyEquivalent(a,b), true);
assert.equal(deepEqual(a,b), false);

```
<br/>
<br/>

### Options

<br/>

#### RequireArrayOrdering

By default array ordering is required but it can be easily disabled as seen below.


```ts
import { seriallyEquivalent, SeriallyEquivalentOptions } from 'serially-equivalent';
import deepEqual from 'deep-equal';

const a = {
    arr: [{ name: 'Ben'}, { name: 'Sam'}],
};

const b = {
    arr: [{ name: 'Sam'}, { name: 'Ben'}]
};
const opts: SeriallyEquivalentOptions = {
    requireArrayOrdering: false,
}
assert.equal(seriallyEquivalent(a,b, opts), true);
assert.equal(deepEqual(a,b), false);

```
<br/>

#### ExcludedProperties

You can exclude properties from comparison by specifying a string array of properties to be excluded.
Property names are seperated by `.` and `root` is always the prefix.

Array example
```ts
import { seriallyEquivalent, SeriallyEquivalentOptions } from 'serially-equivalent';
import deepEqual from 'deep-equal';

const a = {
    arr: [{ name: 'Ben', age: 33, favoriteColor: 'blue'}],
};

const b = {
    arr: [{ name: 'Ben', age: 33, favoriteColor: 'red'}]
};
const opts: SeriallyEquivalentOptions = {
    excludedProperties: ['root.arr.favoriteColor'],
}
assert.equal(seriallyEquivalent(a,b, opts), true);
assert.equal(deepEqual(a,b), false);

```

Object example
```ts
import { seriallyEquivalent, SeriallyEquivalentOptions } from 'serially-equivalent';
import deepEqual from 'deep-equal';

const a = {
    name: 'Ben',
    address: {
        city: 'Baltimore',
        state: 'MD',
        guid: '370e9584-4db9-4e20-8972-f8eae5c81d35',
    }
};

const b = {
    name: 'Ben',
    address: {
        city: 'Baltimore',
        state: 'MD',
        guid: 'a93c1253-8b8f-4e3d-8794-2819e4411a4c',
    }
};
const opts: SeriallyEquivalentOptions = {
    excludedProperties: ['root.address.guid'],
}
assert.equal(seriallyEquivalent(a,b, opts), true);
assert.equal(deepEqual(a,b), false);

```

<br/>

#### Debugging

With complex objects it can be helpful to know where a mismatch occured within the structure of the object.
We optionally allow you to inject a debug function to log the mismatch.


```ts
import { seriallyEquivalent, SeriallyEquivalentOptions } from 'serially-equivalent';
import deepEqual from 'deep-equal';

const a = {
    name: 'Ben',
    age: 33,
};

const b = {
    name: 'Ben',
    age: 32,
};

const opts: SeriallyEquivalentOptions = {
    debug: (msg: string) => { console.warn(msg);}
}
assert.equal(seriallyEquivalent(a,b, opts), false);


//  console.warn
//    Equivalence failed at root.age for issue: Actual not equal to expected. One may not be truthy...
//            truthy status actual: true
//            truthy status expected: true. 
//            Or both do not have typeof object and unmatched values...
//            typof actual: number
//            typeof expected: number
//            value actual: 33
//            value expected: 32

```


These are the basic use cases for the library. 