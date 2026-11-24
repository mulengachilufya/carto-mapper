"""Render the shared terrain grid with a bounded, editable Blender recipe."""

from array import array
from math import cos, radians, sin
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def srgb(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels)


def text_object(camera, label, x, y, width, size, font, material):
    curve = bpy.data.curves.new(label[:40], "FONT")
    curve.body = label
    if font:
        curve.font = font
    curve.size = size
    obj = bpy.data.objects.new(label[:40], curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = camera
    obj.location = (x, y, -2)
    obj.data.materials.append(material)
    bpy.context.view_layer.update()
    if obj.dimensions.x > width:
        curve.size *= width / obj.dimensions.x


def render(project_file, folder):
    project_file, folder = Path(project_file), Path(folder)
    job = json.loads(project_file.read_text())
    terrain, brief, design = job["terrain"], job["brief"], job["design"]
    nx, ny = terrain["shape"]
    low, high = terrain["elevationM"]
    unit_m = max(nx * terrain["resolutionM"][0], ny * terrain["resolutionM"][1]) / 8
    sx, sy = [m / unit_m for m in terrain["resolutionM"]]
    heights = array("f")
    with (project_file.parent.parent / "elevation.f32").open("rb") as stream:
        heights.fromfile(stream, nx * ny)
    if sys.byteorder != "little":
        heights.byteswap()
    vertices = [
        ((col - (nx - 1) / 2) * sx, ((ny - 1) / 2 - row) * sy, (heights[row * nx + col] - low) / unit_m)
        for row in range(ny) for col in range(nx)
    ]
    faces = [
        (row * nx + col, (row + 1) * nx + col, (row + 1) * nx + col + 1, row * nx + col + 1)
        for row in range(ny - 1) for col in range(nx - 1)
    ]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mesh = bpy.data.meshes.new("Elevation pixel centres")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    surface = bpy.data.objects.new("DEM surface", mesh)
    bpy.context.collection.objects.link(surface)
    surface["metres_per_blender_unit"] = unit_m
    surface["minimum_elevation_m"] = low
    surface["vertical_exaggeration"] = 1
    surface["source_sha256"] = terrain["sourceSha256"]
    surface["projected_crs"] = terrain["crs"]
    for i, coordinate in enumerate(terrain["bounds"]):
        surface[("west_m", "south_m", "east_m", "north_m")[i]] = coordinate
    mesh.polygons.foreach_set("use_smooth", [True] * len(faces))
    values = mesh.attributes.new("normalized_elevation", "FLOAT", "POINT")
    values.data.foreach_set("value", [(v - low) / (high - low) for v in heights])
    material = bpy.data.materials.new("Elevation ramp")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    attr = nodes.new("ShaderNodeAttribute")
    attr.attribute_name = values.name
    ramp = nodes.new("ShaderNodeValToRGB")
    colors = design["colors"]
    for i, color in enumerate(colors):
        pos = i / (len(colors) - 1)
        element = ramp.color_ramp.elements[i] if i < 2 else ramp.color_ramp.elements.new(pos)
        element.position = pos
        element.color = (*srgb(color), 1)
    links = material.node_tree.links
    links.new(attr.outputs["Fac"], ramp.inputs[0])
    links.new(ramp.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])
    nodes.get("Principled BSDF").inputs["Roughness"].default_value = 0.9
    mesh.materials.append(material)

    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Paper")
    scene.world.use_nodes = True
    world_nodes = scene.world.node_tree.nodes
    world_nodes["Background"].inputs["Color"].default_value = (*srgb("#f2f6f5"), 1)
    background = world_nodes.new("ShaderNodeBackground")
    background.inputs["Color"].default_value = (*srgb("#f2f6f5"), 1)
    world_nodes["Background"].inputs["Strength"].default_value = 0.65
    camera_ray = world_nodes.new("ShaderNodeLightPath")
    mix = world_nodes.new("ShaderNodeMixShader")
    world_links = scene.world.node_tree.links
    world_links.new(camera_ray.outputs["Is Camera Ray"], mix.inputs[0])
    world_links.new(world_nodes["Background"].outputs[0], mix.inputs[1])
    world_links.new(background.outputs[0], mix.inputs[2])
    world_links.new(mix.outputs[0], world_nodes["World Output"].inputs["Surface"])
    sun = bpy.data.lights.new("Relief light", "SUN")
    sun.energy = 2.35
    sun.angle = radians(12)
    lamp = bpy.data.objects.new("Relief light", sun)
    bpy.context.collection.objects.link(lamp)

    def sightline(azimuth, altitude):
        a, e = radians(azimuth), radians(altitude)
        return Vector((sin(a) * cos(e), cos(a) * cos(e), sin(e)))

    lamp.rotation_euler = (-sightline(design["sunAzimuth"], 48)).to_track_quat("-Z", "Y").to_euler()
    direction = sightline(design["cameraAzimuth"], design["cameraElevation"])
    camera = bpy.data.objects.new("Terrain camera", bpy.data.cameras.new("Orthographic terrain"))
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera.data.type = "ORTHO"
    orientation = (-direction).to_track_quat("-Z", "Y")
    camera.rotation_euler = orientation.to_euler()
    right, up = [orientation @ Vector(v) for v in [(1, 0, 0), (0, 1, 0)]]
    corners = [Vector((x, y, z)) for x in [vertices[0][0], vertices[-1][0]]
               for y in [vertices[0][1], vertices[-1][1]] for z in [0, (high - low) / unit_m]]
    xs, ys = [p.dot(right) for p in corners], [p.dot(up) for p in corners]
    width = max((max(xs) - min(xs)) / 0.89, (max(ys) - min(ys)) / (0.75 * 0.70))
    center = right * ((min(xs) + max(xs)) / 2) + up * ((min(ys) + max(ys)) / 2 + width * 0.025)
    camera.location = center + direction * (width + (high - low) / unit_m + 10)
    camera.data.ortho_scale = width
    camera.data.clip_end = max(100, camera.location.length * 2)

    def text_material(name, color):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        emission = nodes.new("ShaderNodeEmission")
        emission.inputs[0].default_value = (*srgb(color), 1)
        mat.node_tree.links.new(emission.outputs[0], nodes.get("Material Output").inputs["Surface"])
        return mat

    ink = text_material("Headline", "#152522")
    muted = text_material("Secondary text", "#405957")
    font_dir = Path("/usr/share/fonts/truetype/dejavu")
    bold_path = font_dir / "DejaVuSans-Bold.ttf"
    normal_path = font_dir / "DejaVuSans.ttf"
    bold = bpy.data.fonts.load(str(bold_path)) if bold_path.is_file() else None
    normal = bpy.data.fonts.load(str(normal_path)) if normal_path.is_file() else None
    left, text_width = -width * 0.44, width * 0.88
    text_object(camera, brief["title"], left, width * 0.30, text_width, width * 0.045, bold, ink)
    text_object(camera, "Oblique terrain view · 1× vertical scale", left, width * 0.256, text_width, width * 0.020, normal, muted)
    text_object(camera, f"Source · {brief['attribution']}", left, -width * 0.339, text_width, width * 0.019, normal, muted)

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.view_settings.view_transform = "Standard"
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 1080
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = "//scene.png"
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(folder / "scene.blend"))
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    render(*sys.argv[sys.argv.index("--") + 1:])
