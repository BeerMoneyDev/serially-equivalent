/**
 * Options to make almost equals flexible
 */

export interface SeriallyEquivalentOptions {
  /**
   * Does the order of elements in arrays matter to your usecase?
   * Or... do you only care that the array length matches and that all elements are
   * equivalent by value.
   * Defaults to true.
   */
  requireArrayOrdering?: boolean;

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
