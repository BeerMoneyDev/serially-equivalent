/**
 * Options to make almost equals flexible
 */

export interface SeriallyEquivalentOptions {
  /**
   * Does the order of elements in arrays matter to your usecase?
   * Or... do you only care that the array length matches and that all elements are
   * equivalent by value.
   * Defaults to false: when unset, array ordering is NOT required and arrays are
   * matched by content. Set to true to compare arrays index by index.
   */
  requireArrayOrdering?: boolean;

  /**
   * Which arrays `requireArrayOrdering: false` applies to.
   * 'properties' (default) ignores ordering only for arrays that are properties of
   * the compared objects; a bare array compared at the root, or an array nested
   * directly inside another array, is still compared index by index.
   * 'all' also ignores ordering for the root value and for arrays nested inside arrays.
   * Has no effect when requireArrayOrdering is true.
   */
  arrayOrderingScope?: 'properties' | 'all';

  /**
   * If specific properties need to be excluded from comparison that can be done so here.
   * Everything starts with root.
   */
  excludedProperties?: string[];

  /**
   * If you need to identify which properties are not resolving as the same.
   */
  debug?: (message: string) => void;
}
