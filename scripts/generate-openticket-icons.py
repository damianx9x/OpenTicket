#!/usr/bin/env python3
"""Generate OpenTicket app icons (png + ico + icns iconset source)."""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "desktop" / "assets"
ICONSET_DIR = ASSETS_DIR / "icon.iconset"


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def gradient_bg(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    px = image.load()
    for y in range(size):
        ty = y / max(1, size - 1)
        for x in range(size):
            tx = x / max(1, size - 1)
            mix = (tx * 0.48) + (ty * 0.52)
            r = int(lerp(55, 11, mix))
            g = int(lerp(124, 79, mix))
            b = int(lerp(255, 219, mix))
            px[x, y] = (r, g, b, 255)
    return image


def round_rect(draw: ImageDraw.ImageDraw, bbox, radius: int, fill):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill)


def build_icon(size: int) -> Image.Image:
    canvas = gradient_bg(size)
    draw = ImageDraw.Draw(canvas)
    pad = int(size * 0.09)
    round_rect(draw, (pad, pad, size - pad, size - pad), int(size * 0.23), fill=(255, 255, 255, 20))

    inset = int(size * 0.2)
    ticket_box = (inset, int(size * 0.17), size - inset, size - int(size * 0.16))
    round_rect(draw, ticket_box, int(size * 0.08), fill=(10, 41, 112, 255))

    inner = (
        ticket_box[0] + int(size * 0.032),
        ticket_box[1] + int(size * 0.04),
        ticket_box[2] - int(size * 0.032),
        ticket_box[3] - int(size * 0.04),
    )
    round_rect(draw, inner, int(size * 0.065), fill=(242, 247, 255, 255))

    # check mark
    stroke = max(4, int(size * 0.055))
    draw.line(
        [
            (int(size * 0.38), int(size * 0.52)),
            (int(size * 0.48), int(size * 0.62)),
            (int(size * 0.66), int(size * 0.42)),
        ],
        fill=(24, 85, 201, 255),
        width=stroke,
        joint="curve",
    )

    # top-right notification pill
    bubble_r = int(size * 0.065)
    bubble_cx, bubble_cy = int(size * 0.67), int(size * 0.34)
    draw.ellipse(
        (
            bubble_cx - bubble_r,
            bubble_cy - bubble_r,
            bubble_cx + bubble_r,
            bubble_cy + bubble_r,
        ),
        fill=(250, 252, 255, 255),
    )
    plus_w = max(2, int(size * 0.012))
    plus_l = int(size * 0.03)
    draw.line(
        [
            (bubble_cx - plus_l, bubble_cy),
            (bubble_cx + plus_l, bubble_cy),
        ],
        fill=(32, 96, 222, 255),
        width=plus_w,
    )
    draw.line(
        [
            (bubble_cx, bubble_cy - plus_l),
            (bubble_cx, bubble_cy + plus_l),
        ],
        fill=(32, 96, 222, 255),
        width=plus_w,
    )

    # subtle gloss
    gloss = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    gloss_draw = ImageDraw.Draw(gloss)
    gloss_draw.ellipse(
        (int(size * 0.1), int(size * -0.1), int(size * 0.95), int(size * 0.55)),
        fill=(255, 255, 255, 35),
    )
    gloss = gloss.filter(ImageFilter.GaussianBlur(radius=max(2, int(size * 0.01))))
    canvas.alpha_composite(gloss)
    return canvas


def write_iconset(master: Image.Image) -> None:
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)
    sizes = [16, 32, 64, 128, 256, 512]
    for size in sizes:
        normal = master.resize((size, size), Image.Resampling.LANCZOS)
        normal.save(ICONSET_DIR / f"icon_{size}x{size}.png", format="PNG")
        retina = master.resize((size * 2, size * 2), Image.Resampling.LANCZOS)
        retina.save(ICONSET_DIR / f"icon_{size}x{size}@2x.png", format="PNG")


def main() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    master = build_icon(1024)
    master.save(ASSETS_DIR / "icon.png", format="PNG")
    write_iconset(master)

    # Windows icon
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save(ASSETS_DIR / "icon.ico", format="ICO", sizes=ico_sizes)

    print("Generated:")
    print(f"- {ASSETS_DIR / 'icon.png'}")
    print(f"- {ASSETS_DIR / 'icon.ico'}")
    print(f"- {ICONSET_DIR}")


if __name__ == "__main__":
    main()
