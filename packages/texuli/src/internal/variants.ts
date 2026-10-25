import { type ClassInput, cx } from './cx.ts';

/**
 * Lightweight variant composer (no tailwind-variants). Maps discrete props to
 * class strings and merges a consumer `class` last.
 */

export type VariantMap = Record<string, Record<string, string>>;

/**
 * No variant keys (`keyof` is `never`). Prefer this over `{}` / `Record<string, never>`
 * so `VariantPropsOf` does not grow a string index that fights `class?: ClassInput`.
 */
export type EmptyVariantMap = Record<never, Record<string, string>>;

export interface VariantsConfig<V extends VariantMap = EmptyVariantMap> {
  base?: string;
  variants?: V;
  defaultVariants?: { [K in keyof V]?: keyof V[K] & string };
}

export type VariantPropsOf<V extends VariantMap = EmptyVariantMap> = {
  [K in keyof V]?: keyof V[K] & string;
} & {
  /** Consumer `class` — Svelte ClassValue plus null/undefined/falsy leftovers. */
  class?: ClassInput;
};

export function variants<V extends VariantMap = EmptyVariantMap>(
  config: VariantsConfig<V>
): (props?: VariantPropsOf<V>) => string {
  const variantKeys = Object.keys(config.variants ?? {}) as (keyof V & string)[];

  return function compound(props: VariantPropsOf<V> = {} as VariantPropsOf<V>): string {
    const classes: ClassInput[] = [config.base];
    for (const key of variantKeys) {
      const map = config.variants?.[key];
      if (!map) continue;
      const chosen =
        (props[key as keyof VariantPropsOf<V>] as string | undefined) ??
        (config.defaultVariants?.[key] as string | undefined);
      if (chosen !== undefined && chosen in map) {
        classes.push(map[chosen]);
      }
    }
    classes.push(props.class);
    return cx(...classes);
  };
}
