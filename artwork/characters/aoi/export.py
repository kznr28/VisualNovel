"""Rebuild Aoi's lossless game sprites. Requires Python 3 and Pillow with WebP."""
from pathlib import Path

from PIL import Image, ImageChops

ART = Path(__file__).resolve().parent
DEST = ART.parents[2] / "assets" / "characters" / "aoi"
FACE_BOX = (640, 199, 865, 395)
GAME_SIZE = (1024, 1536)


def export():
    normal = Image.open(ART / "normal.png").convert("RGBA")
    assert normal.size == (1536, 2304)
    DEST.mkdir(parents=True, exist_ok=True)
    for tile in [None, *sorted((ART / "expressions").glob("*.png"))]:
        frame = normal.copy()
        if tile:
            patch = Image.open(tile).convert("RGBA")
            assert patch.size == normal.crop(FACE_BOX).size
            assert patch.getchannel("A").tobytes() == normal.crop(FACE_BOX).getchannel("A").tobytes()
            frame.paste(patch, FACE_BOX)
        name = tile.stem if tile else "normal"
        game = frame.resize(GAME_SIZE, Image.Resampling.LANCZOS)
        transparent = game.getchannel("A").point(lambda alpha: 255 if alpha == 0 else 0)
        game.paste((0, 0, 0, 0), mask=transparent)
        path = DEST / f"{name}.webp"
        game.save(path, lossless=True, exact=True, method=6)
        with Image.open(path) as decoded:
            assert decoded.mode == "RGBA" and decoded.size == GAME_SIZE
            assert decoded.getchannel("A").getextrema() == (0, 255)
            assert ImageChops.difference(game, decoded).getbbox(alpha_only=False) is None
        print(f"{name}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    export()
