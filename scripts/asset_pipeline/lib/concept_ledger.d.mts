export function makeLogger(path: string): (line: string) => void;
export interface Ledger<T extends { id: string }> {
  rows: T[];
  has(id: string): boolean;
  get(id: string): T | undefined;
  upsert(row: T): Promise<void>;
}
// The default lets a caller write `makeLedger(path)` and upsert whatever row shape it needs,
// same as the plain JS behind it, without inference from `path: string` forcing T down to the
// bare `{ id: string }` constraint and rejecting every other field as excess.
export function makeLedger<T extends { id: string } = { id: string } & Record<string, unknown>>(
  path: string,
): Ledger<T>;
export function writeWebCopy(
  fullPath: string,
  webPath: string,
  box: { width: number; height: number },
): Promise<number>;
export function positiveInt(name: string, value: unknown): number;
