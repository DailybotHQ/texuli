export interface TypingLabels {
  one: (name: string) => string;
  two: (first: string, second: string) => string;
  many: (count: number) => string;
}
