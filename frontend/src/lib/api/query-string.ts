/** Builds a plain params object for axios, dropping undefined/empty values. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(params) as Array<keyof T>) {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "") {
      result[key] = value;
    }
  }
  return result;
}
