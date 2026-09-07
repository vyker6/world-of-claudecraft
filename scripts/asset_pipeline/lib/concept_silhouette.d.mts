export interface RawImage {
  data: Buffer;
  width: number;
  height: number;
}
export interface AlphaBbox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export const ALPHA_SUBJECT: number;
export function readRaw(path: string): Promise<RawImage>;
export function alphaBbox(img: RawImage): AlphaBbox | null;
