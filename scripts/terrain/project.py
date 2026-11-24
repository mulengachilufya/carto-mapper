"""Validate the brief and prepare the single terrain dataset used by both engines."""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

MAX_SIDE = 320
PALETTES = {
    "alpine": ["#173b42", "#397369", "#799d78", "#b9cdb0", "#f6f5eb"],
    "mineral": ["#29364f", "#526182", "#838fad", "#b8c0d8", "#f7f4fb"],
}


def read_brief(path: Path) -> tuple[dict, Path]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict):
        raise ValueError("The terrain brief must be a JSON object.")
    source = raw.get("source")
    if not isinstance(source, dict) or source.get("verticalUnit") != "m":
        raise ValueError("Specify source.verticalUnit as 'm' for elevation in metres.")

    def required_text(obj, key, limit):
        value = obj.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            raise ValueError(f"{key} must contain 1 to {limit} characters.")
        return " ".join(value.split()).replace("\u2014", ",").replace("\u2013", " to ")

    attribution = required_text(source, "attribution", 140)
    filename = source.get("path")
    if not isinstance(filename, str) or not filename.strip():
        raise ValueError("source.path must point to a local elevation GeoTIFF.")
    raster = (path.parent / filename).resolve()
    if not raster.is_file():
        raise ValueError("The source GeoTIFF could not be found.")
    brief = {
        "title": required_text(raw, "title", 90),
        "story": required_text(raw, "story", 700),
        "audience": required_text(raw, "audience", 120),
        "attribution": attribution,
    }
    return brief, raster


def prepare(raster: Path, out: Path) -> dict:
    dem = gdal.OpenEx(str(raster), gdal.OF_RASTER | gdal.OF_READONLY, allowed_drivers=["GTiff"])
    if dem is None or dem.RasterCount != 1:
        raise ValueError("Provide a single-band elevation GeoTIFF.")
    width, height = dem.RasterXSize, dem.RasterYSize
    if min(width, height) < 3 or width * height > 25_000_000:
        raise ValueError("Crop the DEM to at least 3 by 3 cells and at most 25 million cells.")
    crs = dem.GetSpatialRef()
    transform = dem.GetGeoTransform(can_return_null=True)
    if crs is None or not crs.IsProjected() or not math.isclose(crs.GetLinearUnits(), 1):
        raise ValueError("Reproject the DEM to a local projected CRS whose units are metres (such as UTM).")
    if (transform is None or not all(map(math.isfinite, transform)) or transform[2] or transform[4]
            or transform[1] <= 0 or transform[5] >= 0):
        raise ValueError("The DEM must be a north-up raster with a defined geotransform.")

    band = dem.GetRasterBand(1)
    nodata = band.GetNoDataValue()
    if band.GetScale() not in (None, 1) or band.GetOffset() not in (None, 0):
        raise ValueError("Apply the source band scale and offset before rendering.")
    if band.GetUnitType().lower() not in ("", "m", "meter", "metre", "meters", "metres"):
        raise ValueError("The GeoTIFF band reports a vertical unit other than metres.")
    if np.issubdtype(band.ReadAsArray(0, 0, 1, 1).dtype, np.complexfloating):
        raise ValueError("Elevation cells must be real numbers.")
    for y in range(0, height, 128):
        rows = min(128, height - y)
        values = band.ReadAsArray(0, y, width, rows)
        mask = band.GetMaskBand().ReadAsArray(0, y, width, rows)
        if not np.isfinite(values).all() or (nodata is not None and np.any(values == nodata)) or np.any(mask == 0):
            raise ValueError("Crop to a complete elevation grid. The DEM contains missing cells.")

    step = min(1, MAX_SIDE / max(width, height))
    options = gdal.TranslateOptions(
        format="GTiff", width=max(3, round(width * step)), height=max(3, round(height * step)),
        outputType=gdal.GDT_Float32, resampleAlg="average", creationOptions=["COMPRESS=DEFLATE"],
    )
    grid = gdal.Translate(str(out / "elevation.tif"), dem, options=options)
    values = grid.ReadAsArray()
    if not np.isfinite(values).all():
        raise ValueError("Elevation values exceed the supported Float32 range.")
    low, high = float(values.min()), float(values.max())
    if low == high:
        raise ValueError("The supplied grid is flat at render resolution. Choose an area with relief.")
    gt = grid.GetGeoTransform()
    nx, ny = grid.RasterXSize, grid.RasterYSize
    values.astype("<f4").tofile(out / "elevation.f32")
    grid = None
    authority = crs.GetAuthorityName(None)
    code = crs.GetAuthorityCode(None)
    with raster.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return {
        "sourceSha256": digest,
        "crs": f"{authority}:{code}" if code and authority else crs.GetName(),
        "bounds": [gt[0], gt[3] + ny * gt[5], gt[0] + nx * gt[1], gt[3]],
        "resolutionM": [gt[1], -gt[5]],
        "shape": [nx, ny],
        "elevationM": [low, high],
        "resampling": "average" if (nx, ny) != (width, height) else "none",
        "verticalExaggeration": 1,
    }
