export interface RawImage {
  data: Buffer;
  width: number;
  height: number;
}
export const ALPHA_SUBJECT: number;
export function readRaw(path: string): Promise<RawImage>;
