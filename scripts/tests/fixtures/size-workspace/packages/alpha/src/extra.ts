export const extra = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value * value, 0);
