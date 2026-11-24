# CartoMapper agent

CartoMapper has a web designer for thematic maps and a local workflow for flat and 3D terrain stories. Both use [curated design references](../lib/design/references.json). Each reference card records its source, a short principle, and a worked design choice. Add notes derived from material with suitable usage rights and keep the source and version.

## Thematic maps

The web designer works in `/create`. Upload or paste data, choose a look, and generate a map. It asks for missing values or locations before generation. A political reference map can use built-in boundaries, and a footprint can use the countries explicitly listed in the brief. The sample button creates a demo with a visible illustrative-data label in the map artwork.

Reports and photos use the optional Anthropic extraction. The app shows a draft with the attachment name and the extracted quotation or OCR text alongside each record. Confirm these against the original before using them. For gazetteer matches, whole town names must be unambiguous in the available geography. Supply coordinates for an individual site.

The designer reads the brief, a deterministic profile, and reference cards selected for the map type. The renderer uses the supplied values. Blank cells remain unmeasured, ambiguous boundaries stay unmatched, and conflicting values for the same boundary are suppressed and listed in the preview. The SVG and PDF share a layout. Choose Atlas, Feature, or Report and set the text size in the preview.

To run the deterministic regression cases, start the app locally without an Anthropic key or Supabase accounts enabled, then run:

```bash
node --test scripts/evaluate-agent.mjs
```

Set `CARTOMAPPER_EVAL_URL` to use a different local port. The cases are regression fixtures, with checks for evidence requirements, units, map selection, and layout. New training examples should be distinct from held-out briefs.

## Flat and 3D terrain stories

The terrain runner uses the system Python with PyQGIS, GDAL, and NumPy, plus a Blender executable. It has been run with QGIS 3.40 and Blender 4.3. It expects a north-up, single-band elevation GeoTIFF in a projected CRS using metres. Crop out missing cells. Elevation must also be in metres. The two engines use the same validated grid and a 1× vertical scale. Where the tool downsamples, the manifest reports the resulting resolution.

Create a brief like this. Paths are relative to the brief.

```json
{
  "title": "Ridges and valleys of the Swiss Alps",
  "audience": "General readers of a geographic feature",
  "story": "Compare the branching high ridgelines with the broad valley running through this part of the Alps.",
  "source": {
    "path": "alps.tif",
    "attribution": "Mapzen Terrain Tiles, N46E007",
    "verticalUnit": "m"
  }
}
```

Run the local worker:

```bash
/usr/bin/python3 scripts/terrain/story.py alps.json --out alps-story
```

A reproducible demonstration uses [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/). Make `alps.tif` next to the brief:

```bash
curl -fsSL https://s3.amazonaws.com/elevation-tiles-prod/skadi/N46/N46E007.hgt.gz -o N46E007.hgt.gz
gzip -dk N46E007.hgt.gz
gdalwarp -t_srs EPSG:32632 -te 390000 5111800 417000 5129800 -tr 90 90 -r bilinear N46E007.hgt alps.tif
```

The output contains two flat plates and two terrain views. Each candidate has an editable QGIS project, QGIS PDF and PNG, and an editable Blender scene and render. Keep the folders together so QGIS resolves the shared elevation raster. For a designed page in Canva, upload the PNG and add surrounding text or graphics in Canva. Edit source layers, materials, and cameras in the QGIS and Blender projects. See the [Canva upload format guide](https://www.canva.com/help/upload-formats-requirements/). The story manifest records the source hash, geometry, render recipes, and selected files.

The runner uses default selections without credentials. Pass `--vision-model MODEL_ID` and provide `ANTHROPIC_API_KEY` to let a vision-capable Anthropic model compare the four rendered previews against the brief. This sends the brief, selected terrain metadata, and images to Anthropic. The reviewer selects a draft and can ask for a lighter hillshade or a higher or lower camera. The worker renders those bounded revisions once and the model compares them with the selected drafts. Every round uses the same geographic inputs.

### Verified example

[Flat QGIS plate](agent-example/swiss-alps-plate.webp) · [Oblique Blender scene](agent-example/swiss-alps-scene.webp)

## Improving creative judgment

Keep a versioned set of briefs, input data references, candidate images, and expert choices. Record the preferred candidate and a concrete explanation for each medium. For example, “The higher camera reveals the connecting valleys that the foreground ridge masks.” Keep geographic correctness as a required check and assess composition, readability, and storytelling on work that passes. Hold out complete datasets and story briefs to measure transfer to new material. Evaluate prompt and reference changes before considering fine-tuning against reviewed preferences.
