"""Create a two-medium CartoMapper story using QGIS and Blender."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from qgis.core import QgsApplication

from project import PALETTES, prepare, read_brief
from qgis_plate import plate
from review import compare


def build(brief_path, output, blender, vision_model=None):
    brief, raster = read_brief(brief_path)
    if vision_model and not os.environ.get("ANTHROPIC_API_KEY"):
        raise ValueError("--vision-model requires ANTHROPIC_API_KEY.")
    if output.exists():
        raise ValueError("Choose a new output directory.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=output.parent, prefix=".cartomapper-") as temporary:
        work = Path(temporary) / "story"
        work.mkdir()
        terrain = prepare(raster, work)
        treatments = {
            "ridgelines": {
                "colors": PALETTES["alpine"], "cameraAzimuth": 212, "cameraElevation": 37,
                "sunAzimuth": 315, "shadeOpacity": 0.29,
            },
            "landforms": {
                "colors": PALETTES["mineral"], "cameraAzimuth": 305, "cameraElevation": 61,
                "sunAzimuth": 295, "shadeOpacity": 0.18,
            },
        }
        application = QgsApplication([], False)
        application.initQgis()

        def render(name, design, media):
            folder = work / name
            folder.mkdir()
            recipe = folder / "design.json"
            recipe.write_text(json.dumps({"brief": brief, "terrain": terrain, "design": design}, indent=2))
            if "flat" in media:
                plate(folder, work, brief, terrain, design)
            if "terrain" in media:
                with (Path(temporary) / "blender.log").open("w+") as log:
                    done = subprocess.run([
                        blender, "-b", "--factory-startup", "-t", "4", "--python-exit-code", "1", "--python",
                        str(Path(__file__).with_name("blender_scene.py").resolve()), "--", str(recipe), str(folder),
                    ], stdout=log, stderr=subprocess.STDOUT, timeout=240, check=False)
                    if done.returncode or not (folder / "scene.png").is_file():
                        log.seek(0)
                        raise RuntimeError("Blender could not render the scene.\n" + "\n".join(log.read().splitlines()[-15:]))

        candidates = {medium: list(treatments) for medium in ("flat", "terrain")}
        review = {
            "flat": {"candidate": "landforms", "reason": "Lighter hillshade keeps the elevation scale legible."},
            "terrain": {"candidate": "ridgelines", "reason": "The lower angle emphasizes relief and ridge profiles."},
        }
        first_review = None
        try:
            for name, design in treatments.items():
                render(name, design, candidates)
            if vision_model:
                first_review = compare(brief, terrain, candidates, work, vision_model, suggest=True)
                review = first_review
                comparison = {medium: [pick["candidate"]] for medium, pick in first_review.items()}
                for medium, pick in first_review.items():
                    adjustment = pick["adjustment"]
                    if adjustment == "none":
                        continue
                    design = treatments[pick["candidate"]].copy()
                    if adjustment == "lighten_hillshade":
                        design["shadeOpacity"] = max(0.06, design["shadeOpacity"] - 0.09)
                    elif adjustment == "raise_camera":
                        design["cameraElevation"] = min(78, design["cameraElevation"] + 12)
                    elif adjustment == "lower_camera":
                        design["cameraElevation"] = max(25, design["cameraElevation"] - 12)
                    name = f"revised-{medium}"
                    render(name, design, (medium,))
                    comparison[medium].append(name)
                    candidates[medium].append(name)
                if any(len(variants) > 1 for variants in comparison.values()):
                    review = compare(brief, terrain, comparison, work, vision_model)
        finally:
            application.exitQgis()

        result = {
            "version": 1, "brief": brief, "terrain": terrain,
            "review": {
                "method": "vision" if vision_model else "default",
                "model": vision_model, "initial": first_review, "choices": review,
            },
            "selected": {
                "flat": f"{review['flat']['candidate']}/plate.qgz",
                "terrain": f"{review['terrain']['candidate']}/scene.blend",
            },
            "candidates": candidates,
        }
        (work / "story.json").write_text(json.dumps(result, indent=2) + "\n")
        if output.exists():
            raise ValueError("The output directory was created by another operation.")
        work.rename(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("brief", type=Path, help="JSON story brief with a local elevation GeoTIFF")
    parser.add_argument("--out", required=True, type=Path, help="New output directory")
    parser.add_argument("--blender", default=shutil.which("blender"), help="Path to the Blender executable")
    parser.add_argument("--vision-model", help="Anthropic model ID for opt-in review of the four rendered previews")
    args = parser.parse_args()
    if not args.blender:
        parser.error("Blender is required. Provide --blender /path/to/blender.")
    try:
        build(args.brief.resolve(), args.out.resolve(), args.blender, args.vision_model)
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        parser.exit(1, f"CartoMapper: {error}\n")
    print(args.out / "story.json")


if __name__ == "__main__":
    main()
