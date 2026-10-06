"""Gera os ícones do PWA (PNG) a partir de um desenho simples: fundo bordô + monograma "M".

Uso: npm run icons   (requer Python 3 + Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BRAND = (159, 58, 92)      # #9f3a5c
PAPER = (250, 247, 242)    # #faf7f2

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_icon(size: int, *, radius_ratio: float, glyph_ratio: float) -> Image.Image:
    scale = 4  # supersampling para bordas suaves
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if radius_ratio > 0:
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * radius_ratio), fill=BRAND)
    else:
        d.rectangle((0, 0, s, s), fill=BRAND)

    font = load_font(int(s * glyph_ratio))
    bbox = d.textbbox((0, 0), "M", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((s - w) / 2 - bbox[0], (s - h) / 2 - bbox[1] - s * 0.01), "M", font=font, fill=PAPER)

    # pequeno ponto de destaque (moeda) no canto do "M"
    r = int(s * 0.045)
    cx, cy = int(s * 0.77), int(s * 0.27)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PAPER)
    return img.resize((size, size), Image.LANCZOS)


draw_icon(192, radius_ratio=0.22, glyph_ratio=0.62).save(OUT / "icon-192.png")
draw_icon(512, radius_ratio=0.22, glyph_ratio=0.62).save(OUT / "icon-512.png")
# maskable: ocupa toda a área (o sistema aplica a máscara); glifo menor para ficar na zona segura
draw_icon(512, radius_ratio=0, glyph_ratio=0.46).save(OUT / "maskable-512.png")
draw_icon(180, radius_ratio=0, glyph_ratio=0.56).save(OUT / "apple-touch-icon.png")
print("Ícones gerados em", OUT)
