import { createContext } from 'svelte';

/** Create a typed Svelte context pair with a useful missing-provider error. */
export function createPrimitiveContext<Value>(name: string) {
  const [read, write] = createContext<Value>();
  return {
    get(): Value {
      try {
        return read();
      } catch (cause) {
        throw new Error(`Missing ${name} provider`, { cause });
      }
    },
    set(value: Value): Value {
      write(value);
      return value;
    },
  };
}
