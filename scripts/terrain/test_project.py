import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import numpy as np
from osgeo import gdal, osr

from project import prepare
from review import validate_review


class TerrainTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "input.tif"

    def grid(self, values, epsg=32632, unit="m", nodata=None):
        crs = osr.SpatialReference()
        crs.ImportFromEPSG(epsg)
        raster = gdal.GetDriverByName("GTiff").Create(str(self.source), values.shape[1], values.shape[0], 1, gdal.GDT_Float32)
        raster.SetSpatialRef(crs)
        raster.SetGeoTransform((410_000, 30, 0, 5_120_000, 0, -30))
        band = raster.GetRasterBand(1)
        band.SetUnitType(unit)
        if nodata is not None:
            band.SetNoDataValue(nodata)
        band.WriteArray(values)
        raster.FlushCache()

    def test_shared_coordinates_and_heights(self):
        values = np.arange(12, dtype=np.float32).reshape((3, 4)) - 5
        self.grid(values)
        terrain = prepare(self.source, self.root)
        self.assertEqual(terrain["shape"], [4, 3])
        self.assertEqual(terrain["bounds"], [410_000, 5_119_910, 410_120, 5_120_000])
        self.assertEqual(terrain["elevationM"], [-5, 6])
        self.assertEqual(terrain["verticalExaggeration"], 1)
        np.testing.assert_equal(np.fromfile(self.root / "elevation.f32", dtype="<f4"), values.flatten())

    def test_nodata_cannot_become_zero_height(self):
        values = np.arange(12, dtype=np.float32).reshape((3, 4))
        values[0, 0] = -9999
        self.grid(values, nodata=-9999)
        with self.assertRaisesRegex(ValueError, "missing cells"):
            prepare(self.source, self.root)

    def test_degrees_cannot_be_used_as_metres(self):
        self.grid(np.arange(12).reshape((3, 4)), epsg=4326)
        with self.assertRaisesRegex(ValueError, "projected CRS"):
            prepare(self.source, self.root)

    def test_vertical_units_are_checked(self):
        self.grid(np.arange(12).reshape((3, 4)), unit="ft")
        with self.assertRaisesRegex(ValueError, "vertical unit"):
            prepare(self.source, self.root)

    def test_visual_review_can_only_select_existing_candidates(self):
        valid = {"flat": {"candidate": "flat-a", "reason": "The title is legible."},
                 "terrain": {"candidate": "terrain-b", "reason": "The valley is visible."}}
        choices = {"flat": ["flat-a"], "terrain": ["terrain-b"]}
        self.assertEqual(validate_review(json.loads(json.dumps(valid)), choices), valid)
        with self.assertRaisesRegex(ValueError, "invalid terrain choice"):
            validate_review(valid, {"flat": ["flat-a"], "terrain": ["terrain-a"]})
        valid["flat"]["adjustment"] = "lighten_hillshade"
        valid["terrain"]["adjustment"] = "raise_camera"
        self.assertEqual(validate_review(valid, choices, suggest=True), valid)
        valid["terrain"]["adjustment"] = "change_the_elevations"
        with self.assertRaisesRegex(ValueError, "invalid terrain choice"):
            validate_review(valid, choices, suggest=True)


if __name__ == "__main__":
    unittest.main()
