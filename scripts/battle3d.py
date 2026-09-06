"""Composite the look-dev duel onto the battle plate, in world units.

Consumes what scripts/render_char.mjs wrote to tmp/duel: one transparent PNG per
timeline frame per fighter, plus timeline.json. Every placement comes from that
file, never from hand-tuned pixel offsets: where each fighter's root stands
(fighters[side].x), how its render canvas maps to world units (view.groundPx,
view.pxPerUnit), where its feet are (the Idle box), which frame each strike lands
on and where (strikes[]), and which frames the attacker is drawn on top
(attackWindows[]).

Writes two RGB frame sequences at the timeline's frame rate, ready for ffmpeg:
tmp/b3d_full (HD sprites) and tmp/b3d_pixel (the same sprites pixelated and
palette-reduced; the plate stays HD in both).

    python scripts/battle3d.py [--duel tmp/duel] [--plate tmp/battle_plate.png]
"""

from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]

PX_PER_UNIT = 208  # plate pixels per world unit
GROUND_Y = 690  # plate row both fighters stand on
CENTER_X = 800  # plate column of the world origin (the midpoint between the roots)
FX_FRAMES = 6  # frames an impact's flash, recoil, spark and shake last
RECOIL_PX = 6  # defender push-back per impact frame, for the first 4 frames
SHAKE_PX = 6  # screen shake amplitude on the impact frame
FLASH_COLOR = (255, 240, 210)
ALPHA_CUT = 8  # alpha below this is empty canvas when measuring a frame's bounds
PIXEL_FACTOR = 6
PIXEL_COLORS = 44
SHAKE_SEED = 11


@dataclass(frozen=True)
class Placement:
    """How one fighter's render canvas lands on the plate."""

    side: str
    dir: int
    frames_dir: Path
    scale: float  # plate pixels per render pixel
    root_col: float  # plate column of the fighter's root
    root_row: float  # plate row of the fighter's root (its feet sit on GROUND_Y)
    canvas_width: int
    canvas_ground: float  # render row of world y=0 (view.groundPx)
    shadow_width: int
    shadow_col: float


def placement(duel_dir: Path, side: str, fighter: dict) -> Placement:
    view = fighter["view"]
    idle = fighter["boxes"]["Idle"]
    foot_y = idle["min"][1]
    root_col = CENTER_X + fighter["x"] * PX_PER_UNIT
    return Placement(
        side=side,
        dir=fighter["dir"],
        frames_dir=duel_dir / side,
        scale=PX_PER_UNIT / view["pxPerUnit"],
        root_col=root_col,
        root_row=GROUND_Y + foot_y * PX_PER_UNIT,
        canvas_width=view["width"],
        canvas_ground=view["groundPx"],
        shadow_width=int((idle["max"][0] - idle["min"][0]) * PX_PER_UNIT * 0.9),
        shadow_col=root_col + (idle["min"][0] + idle["max"][0]) / 2 * PX_PER_UNIT,
    )


def sprite_at(p: Placement, frame: int) -> tuple[Image.Image, tuple[int, int]]:
    """The frame's opaque region scaled to the plate, and its top-left plate position."""
    path = p.frames_dir / f"f{frame:04d}.png"
    im = Image.open(path).convert("RGBA")
    bbox = im.getchannel("A").point(lambda v: 255 if v > ALPHA_CUT else 0).getbbox()
    if bbox is None:
        raise RuntimeError(f"{path} is fully transparent; re-run scripts/render_char.mjs")
    crop = im.crop(bbox)
    size = (max(1, round(crop.width * p.scale)), max(1, round(crop.height * p.scale)))
    sprite = crop.resize(size, Image.LANCZOS)
    x = p.root_col + (bbox[0] - p.canvas_width / 2) * p.scale
    y = p.root_row + (bbox[1] - p.canvas_ground) * p.scale
    return sprite, (round(x), round(y))


def pixelate(img: Image.Image) -> Image.Image:
    w, h = img.size
    dw, dh = max(1, w // PIXEL_FACTOR), max(1, h // PIXEL_FACTOR)
    rgb = img.convert("RGB").resize((dw, dh), Image.LANCZOS)
    alpha = img.getchannel("A").resize((dw, dh), Image.LANCZOS)
    alpha = alpha.point(lambda v: 255 if v > 110 else 0)
    quant = rgb.quantize(
        colors=PIXEL_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE
    )
    out = quant.convert("RGB").resize((w, h), Image.NEAREST).convert("RGBA")
    out.putalpha(alpha.resize((w, h), Image.NEAREST))
    return out


def flash(sprite: Image.Image, amount: float) -> Image.Image:
    if amount <= 0:
        return sprite
    lit = Image.new("RGB", sprite.size, FLASH_COLOR)
    out = Image.blend(sprite.convert("RGB"), lit, min(0.8, amount)).convert("RGBA")
    out.putalpha(sprite.getchannel("A"))
    return out


_SHADOWS: dict[int, Image.Image] = {}


def shadow(width: int) -> Image.Image:
    if width not in _SHADOWS:
        h = max(10, int(width * 0.22))
        s = Image.new("RGBA", (width + 40, h + 40), (0, 0, 0, 0))
        ImageDraw.Draw(s).ellipse([20, 20, 20 + width, 20 + h], fill=(0, 0, 0, 135))
        _SHADOWS[width] = s.filter(ImageFilter.GaussianBlur(10))
    return _SHADOWS[width]


def spark(base: Image.Image, cx: float, cy: float, t: float) -> None:
    """Impact burst at plate point (cx, cy); t runs 0 (hit) to 1 (gone).

    On the hit frame the rays reach well past the ring and the core is a small hot
    point, so it reads as a burst; as the ring expands the rays shorten and fade.
    """
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    radius = 26 + 96 * t
    a = int(240 * (1 - t) ** 1.4)
    for k in range(14):
        ang = math.radians(k * (360 / 14) + t * 22)
        r0 = radius * 0.55
        r1 = radius * (1.7 - 0.6 * t + 0.5 * (k % 2))
        x0, y0 = cx + r0 * math.cos(ang), cy + r0 * math.sin(ang)
        x1, y1 = cx + r1 * math.cos(ang), cy + r1 * math.sin(ang)
        d.line([x0, y0, x1, y1], fill=(255, 224, 150, a), width=max(1, int(5 * (1 - t))))
    ring = [cx - radius, cy - radius, cx + radius, cy + radius]
    d.ellipse(ring, outline=(255, 238, 196, int(a * 0.85)), width=max(1, int(6 * (1 - t))))
    core = 16 * (1 - t) ** 1.5
    d.ellipse([cx - core, cy - core, cx + core, cy + core], fill=(255, 250, 235, a))
    base.alpha_composite(ov.filter(ImageFilter.GaussianBlur(1)))


@dataclass(frozen=True)
class FrameState:
    """Everything about frame `index` that both treatments share."""

    index: int
    order: tuple[str, str]  # draw order, last on top
    hits: dict[str, tuple[int, int]]  # defender -> (attacker dir, frames since impact)
    sparks: tuple[tuple[float, float, float], ...]  # (col, row, t)
    shake: tuple[int, int]


def frame_state(timeline: dict, places: dict[str, Placement], index: int, rng: random.Random):
    on_top = "hero"
    for w in timeline["attackWindows"]:
        if w["from"] <= index <= w["to"]:
            on_top = w["attacker"]
    order = ("enemy", "hero") if on_top == "hero" else ("hero", "enemy")
    hits: dict[str, tuple[int, int]] = {}
    sparks = []
    shake = (0, 0)
    for s in timeline["strikes"]:
        k = index - s["frame"]
        if not 0 <= k < FX_FRAMES:
            continue
        attacker = places[s["attacker"]]
        defender = "enemy" if s["attacker"] == "hero" else "hero"
        hits[defender] = (attacker.dir, k)
        col = CENTER_X + s["x"] * PX_PER_UNIT
        row = attacker.root_row - s["y"] * PX_PER_UNIT
        t = k / FX_FRAMES
        sparks.append((col, row, t))
        if t < 0.5:
            amp = int(SHAKE_PX * (1 - 2 * t))
            shake = (rng.randint(-amp, amp), rng.randint(-amp, amp))
    return FrameState(index, order, hits, tuple(sparks), shake)


def compose(plate: Image.Image, places: dict[str, Placement], st: FrameState, pixel: bool):
    base = plate.copy()
    layers = []
    for side in st.order:
        p = places[side]
        sprite, (x, y) = sprite_at(p, st.index)
        dx = 0
        if side in st.hits:
            attacker_dir, k = st.hits[side]
            dx = attacker_dir * min(k, 4) * RECOIL_PX
            sprite = flash(sprite, 0.5 - 0.13 * k)
        if pixel:
            sprite = pixelate(sprite)
        layers.append((p, sprite, x + dx, y, dx))
    for p, _sprite, _x, _y, dx in layers:
        sh = shadow(p.shadow_width)
        at = (round(p.shadow_col - sh.width / 2 + dx * 0.4), round(GROUND_Y - sh.height / 2))
        base.alpha_composite(sh, at)
    for _p, sprite, x, y, _dx in layers:
        base.alpha_composite(sprite, (x, y))
    for col, row, t in st.sparks:
        spark(base, col, row, t)
    if st.shake != (0, 0):
        shaken = base.copy()
        shaken.paste(base, st.shake)
        base = shaken
    return base.convert("RGB")


def clear_pngs(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("f*.png"):
        old.unlink()


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--duel", default="tmp/duel", help="render_char.mjs output directory")
    ap.add_argument("--plate", default="tmp/battle_plate.png", help="1600x900 backdrop")
    args = ap.parse_args()
    duel_dir = ROOT / args.duel
    timeline_path = duel_dir / "timeline.json"
    if not timeline_path.exists():
        raise SystemExit(f"{timeline_path} not found; run node scripts/render_char.mjs first")
    timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
    plate = Image.open(ROOT / args.plate).convert("RGBA")
    places = {side: placement(duel_dir, side, f) for side, f in timeline["fighters"].items()}
    outs = {False: ROOT / "tmp" / "b3d_full", True: ROOT / "tmp" / "b3d_pixel"}
    for out in outs.values():
        clear_pngs(out)
    rng = random.Random(SHAKE_SEED)
    for index in range(timeline["frames"]):
        st = frame_state(timeline, places, index, rng)
        for pixel, out in outs.items():
            compose(plate, places, st, pixel).save(out / f"f{index:04d}.png")
    for side, p in places.items():
        print(f"{side}: root at col {p.root_col:.1f} row {p.root_row:.1f}, scale {p.scale:.3f}")
    dirs = ", ".join(str(out.relative_to(ROOT)) for out in outs.values())
    print(f"wrote {timeline['frames']} frames at {timeline['fps']} fps to {dirs}")


if __name__ == "__main__":
    main()
