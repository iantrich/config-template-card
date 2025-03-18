export function assertNotNull<T>(value: T | null | undefined): asserts value is T {
  if (value == null) {
    throw new Error('Unexpected null or undefined value');
  }
}

export function isString(value: any): value is string {
  return (typeof value === 'string' || value instanceof String);
}

export function isPromise(value: any): value is Promise<any> {
  return Boolean(value && typeof value.then === 'function');
}

export function somePromise(arr: any[]): boolean {
  return arr.some((v) => isPromise(v));
}
