"""3D -> pixel post-pass: downscale, quantize palette, upscale nearest, optional outline."""
import sys
from PIL import Image, ImageFilter

def pixelate(src, dst, factor=4, colors=64, outline=True):
    im = Image.open(src).convert("RGB")
    W, H = im.size
    dw, dh = W // factor, H // factor
    small = im.resize((dw, dh), Image.LANCZOS)
    q = small.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    if outline:
        edges = q.filter(ImageFilter.FIND_EDGES).convert("L")
        mask = edges.point(lambda v: 255 if v > 40 else 0)
        dark = Image.new("RGB", q.size, (8, 6, 10))
        q = Image.composite(dark, q, mask)
    big = q.resize((W, H), Image.NEAREST)
    big.save(dst)
    print("wrote", dst, f"(factor={factor}, colors={colors}, outline={outline})")

if __name__ == "__main__":
    src = sys.argv[1]
    pixelate(src, sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 4,
             int(sys.argv[4]) if len(sys.argv) > 4 else 64,
             (sys.argv[5] != "0") if len(sys.argv) > 5 else True)
