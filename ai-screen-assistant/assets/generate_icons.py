"""
Generates icon-16/32/48/128.png for the extension: a simple aperture/lens
mark on the ink-navy brand background with the gold accent ring, matching
the overlay/options "viewfinder" design language.
"""
import math
from PIL import Image, ImageDraw

BG = (23, 26, 43, 255)        # --asa-bg-dark
ACCENT = (232, 163, 61, 255)  # --asa-accent (aperture gold)
RING = (79, 176, 165, 255)    # --asa-accent-2 (lens teal), used sparingly

def draw_icon(size):
    scale = 4  # supersample for smooth edges, then downscale
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = s * 0.06
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=s * 0.22, fill=BG)

    cx, cy = s / 2, s / 2
    outer_r = s * 0.34
    inner_r = s * 0.13

    # Outer ring (lens barrel)
    d.ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r],
              outline=RING, width=max(2, int(s * 0.02)))

    # Aperture blades (triangular wedges around the center, iris motif)
    blades = 6
    blade_r = outer_r * 0.92
    for i in range(blades):
        angle = math.radians(i * (360 / blades))
        next_angle = math.radians(i * (360 / blades) + (360 / blades) * 0.55)
        p1 = (cx, cy)
        p2 = (cx + blade_r * math.cos(angle), cy + blade_r * math.sin(angle))
        p3 = (cx + blade_r * math.cos(next_angle), cy + blade_r * math.sin(next_angle))
        d.polygon([p1, p2, p3], fill=(*ACCENT[:3], 60))

    # Center dot (the "shutter")
    d.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=ACCENT)

    img = img.resize((size, size), Image.LANCZOS)
    return img

for size in (16, 32, 48, 128):
    icon = draw_icon(size)
    icon.save(f"/home/claude/ai-screen-assistant/assets/icons/icon-{size}.png")

print("done")
