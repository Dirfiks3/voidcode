#!/usr/bin/env python3
"""Build the complete VoidCode icon set from the supplied logo.jpg.

The source artwork carries a faint watermark in the lower-right corner. The
script removes it with structure-aware inpainting, tints the monochrome mark
with the VoidCode gradient, cuts a supersampled squircle alpha and writes every
platform size needed by the desktop client, the web app and the PWA manifest.

Run: python script/voidcode-icons.py
"""

from __future__ import annotations

from pathlib import Path
import math

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "logo.jpg"
CLEANED = ROOT / "logo-clean.png"

BLUE = np.array([77, 166, 255], dtype=np.float32)
VIOLET = np.array([155, 114, 203], dtype=np.float32)
BACKGROUND = np.array([5, 5, 7], dtype=np.float32)
PANEL = np.array([10, 12, 16], dtype=np.float32)

SIZES = (16, 32, 64, 128, 256, 512, 1024)
DESKTOP_CHANNELS = ("prod", "beta", "dev")


def remove_watermark(image: Image.Image) -> Image.Image:
    """Erase the lower-right signature while keeping the emblem's smooth arcs."""
    rgb = np.asarray(image.convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)

    height, width = gray.shape
    x0, y0 = int(width * 0.62), int(height * 0.72)
    roi = gray[y0:, x0:]

    # The watermark is made of sharp, small strokes. The emblem is built from
    # long smooth arcs, so a laplacian response isolates the signature well.
    edges = np.abs(cv2.Laplacian(roi, cv2.CV_32F, ksize=3))
    signature = (edges > 5.5).astype(np.uint8) * 255
    signature = cv2.morphologyEx(signature, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    signature = cv2.dilate(signature, np.ones((5, 5), np.uint8), iterations=1)

    # Anything living in the outermost corner cannot belong to the emblem.
    corner = np.zeros_like(signature)
    corner[int(roi.shape[0] * 0.78):, int(roi.shape[1] * 0.72):] = 255
    signature = cv2.bitwise_or(signature, corner)

    mask = np.zeros((height, width), dtype=np.uint8)
    mask[y0:, x0:] = signature
    cleaned = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mask, 5, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGB))


def squircle_mask(size: int, radius_ratio: float = 0.26) -> Image.Image:
    """Supersampled superellipse mask with antialiased edges."""
    scale = 4
    dimension = size * scale
    yy, xx = np.mgrid[0:dimension, 0:dimension].astype(np.float32)
    cx = cy = (dimension - 1) / 2
    r = dimension * radius_ratio
    nx = np.abs(xx - cx) / (dimension / 2 - r)
    ny = np.abs(yy - cy) / (dimension / 2 - r)
    # Superellipse exponent 4.6 keeps the flat middle and soft corners of a squircle.
    inside = np.power(nx, 4.6) + np.power(ny, 4.6) <= 1
    mask = Image.fromarray((inside * 255).astype(np.uint8), mode="L")
    return mask.resize((size, size), Image.Resampling.LANCZOS)


def crop_to_emblem(cleaned: Image.Image) -> Image.Image:
    """Trim the dead obsidian field so the emblem reads clearly at taskbar size."""
    gray = np.asarray(cleaned.convert("L"))
    ys, xs = np.where(gray > 120)

    if xs.size == 0:
        return cleaned

    width = int(xs.max() - xs.min()) + 1
    height = int(ys.max() - ys.min()) + 1
    side = int(max(width, height) * 1.08)
    center_x = (int(xs.min()) + int(xs.max())) / 2
    center_y = (int(ys.min()) + int(ys.max())) / 2
    source_size = min(cleaned.size)
    side = min(side, source_size)
    left = int(max(0, min(center_x - side / 2, source_size - side)))
    top = int(max(0, min(center_y - side / 2, source_size - side)))
    return cleaned.crop((left, top, left + side, top + side))


def gradient_tint(cleaned: Image.Image, size: int) -> Image.Image:
    """Turn the near-monochrome mark into a blue -> violet luminous emblem."""
    source = cleaned.convert("L").resize((size, size), Image.Resampling.LANCZOS)
    lum = np.asarray(source, dtype=np.float32) / 255.0

    # Collapse near-black JPEG noise, then lift the light edges without flattening the core.
    lum = np.clip((lum - 0.015) * 1.08, 0, 1)
    lum = np.power(lum, 0.62)

    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    diagonal = np.clip((xx + yy) / (2 * size), 0, 1)
    tint = BLUE[None, None, :] * (1 - diagonal[..., None]) + VIOLET[None, None, :] * diagonal[..., None]

    rgba = np.empty((size, size, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(tint * lum[..., None] + BACKGROUND * (1 - lum[..., None]), 0, 255)
    rgba[..., 3] = 255
    return Image.fromarray(rgba, mode="RGBA")


def compose(size: int, cleaned: Image.Image) -> Image.Image:
    """AMOLED squircle tile with a soft inner glow and a one-pixel glass rim."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    distance = np.sqrt((xx - size / 2) ** 2 + (yy - size / 2) ** 2) / (size / 2)

    base = PANEL[None, None, :] * (1 - distance[..., None] * 0.55) + BACKGROUND * (distance[..., None] * 0.55)
    glow = np.clip(1 - distance / 0.8, 0, 1) ** 3
    base = base + glow[..., None] * np.array([8, 13, 24], dtype=np.float32)

    canvas = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), mode="RGB").convert("RGBA")

    mark = gradient_tint(cleaned, size)
    # The source is already cropped; keep only enough room for the glass rim.
    inset = round(size * 0.025)
    mark = mark.resize((size - 2 * inset, size - 2 * inset), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark, (inset, inset))

    mask = squircle_mask(size)
    canvas.putalpha(mask)

    # Gradient border, drawn at 4x and downsampled so it stays crisp at every size.
    rim = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(rim)
    steps = 90
    points = []
    radius_ratio = 0.26
    r = size * 4 * radius_ratio
    limit = size * 2 - r
    for index in range(steps + 1):
        angle = 2 * math.pi * index / steps
        # Parametric superellipse.
        c, s = math.cos(angle), math.sin(angle)
        exponent = 2 / 4.6
        px = size * 2 + limit * math.copysign(abs(c) ** exponent, c)
        py = size * 2 + limit * math.copysign(abs(s) ** exponent, s)
        points.append((px, py))
    width = max(1, size // 220)
    draw.line(points + [points[0]], fill=(155, 114, 203, 190), width=width)
    rim = rim.resize((size, size), Image.Resampling.LANCZOS)
    rim.putalpha(Image.composite(rim.getchannel("A"), Image.new("L", (size, size), 0), mask))
    canvas.alpha_composite(rim)
    canvas.putalpha(mask)
    return canvas


def write_set(
    icon: Image.Image,
    directory: Path,
    *,
    favicon_sizes: tuple[tuple[int, int], ...] = ((16, 16), (32, 32), (48, 48)),
) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        icon.resize((size, size), Image.Resampling.LANCZOS).save(directory / f"{size}x{size}.png")
    icon.save(directory / "icon.png")
    icon.save(directory / "icon.ico", sizes=[(size, size) for size in (16, 24, 32, 48, 64, 128, 256)])
    icon.save(directory / "favicon.ico", sizes=list(favicon_sizes))
    icon.save(directory / "icon.icns", sizes=[(size, size) for size in (16, 32, 64, 128, 256, 512, 1024)])


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source artwork: {SOURCE}")

    cleaned = crop_to_emblem(remove_watermark(Image.open(SOURCE)))
    cleaned.save(CLEANED)

    master = compose(1024, cleaned)

    ui_assets = ROOT / "packages/ui/src/assets/favicon"
    write_set(master, ui_assets)
    master.resize((512, 512), Image.Resampling.LANCZOS).save(ui_assets / "icon-512.png")

    web_public = ROOT / "packages/app/public"
    write_set(master, web_public)
    master.resize((96, 96), Image.Resampling.LANCZOS).save(web_public / "favicon-96x96.png")
    master.resize((96, 96), Image.Resampling.LANCZOS).save(web_public / "favicon-96x96-v3.png")
    master.resize((180, 180), Image.Resampling.LANCZOS).save(web_public / "apple-touch-icon.png")
    master.resize((180, 180), Image.Resampling.LANCZOS).save(web_public / "apple-touch-icon-v3.png")
    master.resize((192, 192), Image.Resampling.LANCZOS).save(web_public / "web-app-manifest-192x192.png")
    master.resize((512, 512), Image.Resampling.LANCZOS).save(web_public / "web-app-manifest-512x512.png")

    for channel in DESKTOP_CHANNELS:
        write_set(master, ROOT / "packages/desktop/icons" / channel)

    # Social share art uses the same emblem over the obsidian field.
    social = Image.new("RGB", (1200, 630), (5, 5, 7))
    badge = master.resize((360, 360), Image.Resampling.LANCZOS)
    social.paste(badge, (420, 135), badge)
    social.save(ROOT / "packages/ui/src/assets/images/social-share.png")
    social.save(ROOT / "packages/ui/src/assets/images/social-share-zen.png")
    social.save(web_public / "social-share.png")
    social.save(web_public / "social-share-zen.png")

    print(f"wrote VoidCode icon set from {SOURCE.name} -> {CLEANED.name}")


if __name__ == "__main__":
    main()
