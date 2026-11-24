"""Build an editable QGIS print layout with a documented elevation scale."""

import math
from pathlib import Path

from osgeo import gdal
from qgis.PyQt.QtGui import QColor, QFont
from qgis.core import (
    Qgis,
    QgsColorRampShader,
    QgsFillSymbol,
    QgsLayoutExporter,
    QgsLayoutItemLabel,
    QgsLayoutItemMap,
    QgsLayoutItemShape,
    QgsLayoutPoint,
    QgsLayoutSize,
    QgsPrintLayout,
    QgsProject,
    QgsRasterLayer,
    QgsRasterShader,
    QgsRectangle,
    QgsReferencedRectangle,
    QgsSingleBandPseudoColorRenderer,
)


def plate(out: Path, shared: Path, brief: dict, terrain: dict, design: dict) -> None:
    project = QgsProject.instance()
    project.clear()
    project.setFileName(str(out / "plate.qgz"))
    elevation = QgsRasterLayer(str(shared / "elevation.tif"), "Elevation in metres")
    if not elevation.isValid():
        raise RuntimeError("QGIS could not load the validated elevation grid.")
    project.setCrs(elevation.crs())
    low, high = terrain["elevationM"]
    colors = design["colors"]
    stops = [low + (high - low) * i / (len(colors) - 1) for i in range(len(colors))]
    color_function = QgsColorRampShader(low, high)
    color_function.setColorRampItemList([
        QgsColorRampShader.ColorRampItem(value, QColor(color), str(round(value)))
        for value, color in zip(stops, colors)
    ])
    shader = QgsRasterShader(low, high)
    shader.setRasterShaderFunction(color_function)
    renderer = QgsSingleBandPseudoColorRenderer(elevation.dataProvider(), 1, shader)
    renderer.setClassificationMin(low)
    renderer.setClassificationMax(high)
    elevation.setRenderer(renderer)
    project.addMapLayer(elevation)

    shade_path = out / "hillshade.tif"
    shade_file = gdal.DEMProcessing(str(shade_path), str(shared / "elevation.tif"), "hillshade",
                                  azimuth=design["sunAzimuth"], altitude=48, computeEdges=True)
    shade_file = None
    shade = QgsRasterLayer(str(shade_path), "Hillshade")
    shade.setOpacity(design["shadeOpacity"])
    project.addMapLayer(shade)

    layout = QgsPrintLayout(project)
    layout.initializeDefaults()
    layout.setName("Terrain story")
    layout.pageCollection().pages()[0].setPageSize(QgsLayoutSize(240, 180))
    project.layoutManager().addLayout(layout)
    ink = QColor("#152522")

    def label(text, x, y, w, h, size, bold=False):
        item = QgsLayoutItemLabel(layout)
        item.setText(text)
        font = QFont("DejaVu Sans")
        font.setPointSizeF(size)
        font.setBold(bold)
        item.setFont(font)
        item.setFontColor(ink)
        item.setMargin(0)
        layout.addLayoutItem(item)
        item.attemptMove(QgsLayoutPoint(x, y))
        item.attemptResize(QgsLayoutSize(w, h))
        # Use QGIS font metrics rather than relying on a fixed title-size assumption.
        while item.sizeForText().width() > w and font.pointSizeF() > (13 if bold else 8):
            font.setPointSizeF(font.pointSizeF() - 0.5)
            item.setFont(font)
        if item.sizeForText().width() > w:
            raise ValueError("Shorten the title or source so the map label fits the page.")
        return item

    def swatch(x, y, width, height, fill):
        item = QgsLayoutItemShape(layout)
        item.setShapeType(QgsLayoutItemShape.Rectangle)
        item.setSymbol(QgsFillSymbol.createSimple({"color": fill, "outline_style": "no"}))
        layout.addLayoutItem(item)
        item.attemptMove(QgsLayoutPoint(x, y))
        item.attemptResize(QgsLayoutSize(width, height))

    swatch(11, 10, 17, 1.2, colors[1])
    label(brief["title"], 11, 14, 218, 14, 28, True)
    label("Elevation and shaded relief", 11, 29, 218, 6, 12)

    xmin, ymin, xmax, ymax = terrain["bounds"]
    ratio = (xmax - xmin) / (ymax - ymin)
    map_w, map_h = min(218, 111 * ratio), min(111, 218 / ratio)
    x, y = (240 - map_w) / 2, 39 + (111 - map_h) / 2
    view = QgsLayoutItemMap(layout)
    layout.addLayoutItem(view)
    view.attemptMove(QgsLayoutPoint(x, y))
    view.attemptResize(QgsLayoutSize(map_w, map_h))
    view.setCrs(elevation.crs())
    view.setLayers([shade, elevation])
    view.setKeepLayerSet(True)
    view.zoomToExtent(QgsRectangle(xmin, ymin, xmax, ymax))
    label("Grid north up", 11, 151, 31, 5, 10)
    label("Elevation (m)", 11, 158, 31, 6, 10, True)
    label(f"{math.floor(low):,}", 44, 158, 18, 6, 10)
    for i in range(64):
        position = (i + 0.5) / 64 * (len(colors) - 1)
        index = int(position)
        a, b = QColor(colors[index]), QColor(colors[index + 1])
        weight = position - index
        rgb = [round(p * (1 - weight) + q * weight) for p, q in zip(a.getRgb()[:3], b.getRgb()[:3])]
        swatch(64 + 1.25 * i, 160, 1.28, 2.2, QColor(*rgb).name())
    label(f"{math.ceil(high):,}", 147, 158, 20, 6, 10)
    label(f"Source · {brief['attribution']}", 11, 168, 218, 6, 9)

    project.viewSettings().setDefaultViewExtent(QgsReferencedRectangle(view.extent(), elevation.crs()))
    if not project.write():
        raise RuntimeError("QGIS could not save the editable project.")
    exporter = QgsLayoutExporter(layout)
    preview = exporter.renderPageToImage(0, dpi=145)
    if preview.isNull() or not preview.save(str(out / "plate.png")):
        raise RuntimeError("QGIS could not render the preview.")
    pdf = QgsLayoutExporter.PdfExportSettings()
    pdf.dpi = 300
    pdf.textRenderFormat = Qgis.TextRenderFormat.AlwaysText
    if exporter.exportToPdf(str(out / "plate.pdf"), pdf) != QgsLayoutExporter.Success:
        raise RuntimeError("QGIS could not export the PDF.")
    project.clear()
