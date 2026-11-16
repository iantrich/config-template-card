/** Helpers for templates that return Promises (from #159 and #149). */

export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as PromiseLike<unknown>).then === 'function';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Whether a Promise sits anywhere in a structure of plain objects and arrays. */
export const containsThenable = (value: unknown): boolean => {
  if (isThenable(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsThenable);
  }
  if (isPlainObject(value)) {
    return Object.values(value).some(containsThenable);
  }
  return false;
};

/** Returns a copy of the structure with every Promise replaced by its settled value. */
export const resolveDeep = async (value: unknown): Promise<unknown> => {
  if (isThenable(value)) {
    return resolveDeep(await value);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map(resolveDeep));
  }
  if (isPlainObject(value) && containsThenable(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, entry]) => [key, await resolveDeep(entry)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
};

export const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as FunctionConstructor;
