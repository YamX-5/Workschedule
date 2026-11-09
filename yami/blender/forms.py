# Yami character forms: builds the character in Blender and renders the turntables.
#
# Full run (all 11 tiers x 24 frames, writes assets/forms/t*/NN.webp + src/ui/formFrames.ts):
#   "D:\Tools\blender-5.2.0-windows-x64\blender.exe" -b -P "D:\My Apps\Yami\yami\blender\forms.py"
# Preview run (subset, into another folder, no .ts written):
#   blender.exe -b -P forms.py -- --tiers 0,5,10 --frames 0,6 --out C:\some\dir
# Contact sheet (frame 00 + 06 per tier on #030308): add  --sheet C:\path\forms-sheet.png
#
# Pure built-in primitives/modifiers, EEVEE, no add-ons. Upgrades are cumulative: every
# object carries a "tier" (first tier it appears) and optional "until" (last tier it shows).
import bpy, bmesh, math, os, sys, time
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
W, H, FRAMES = 360, 480, 24

# ---- args -----------------------------------------------------------------
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default
TIERS = [int(t) for t in arg("--tiers", ",".join(map(str, range(11)))).split(",")]
FRAME_LIST = [int(f) for f in arg("--frames", ",".join(map(str, range(FRAMES)))).split(",")]
OUT = arg("--out", os.path.join(APP, "assets", "forms"))
SHEET = arg("--sheet")
FULL = "--tiers" not in argv and "--frames" not in argv and "--out" not in argv

# ---- palette (app tokens, linear-ish via hex) -----------------------------
def hx(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*c, a)
INK, PURPLE, PURPLE_HI, PURPLE_SOFT, ICE, WHITE = (
    hx("#0B0816"), hx("#2A1252"), hx("#6B3BD9"), hx("#9B78F2"), hx("#8FDCFF"), hx("#F2F0F7"))

# ---- scene reset ----------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

def mat(name, base, rough=0.6, metal=0.0, emit=None, strength=0.0, rim=None, rim_str=0.0, cull=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = base
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = emit
        p.inputs["Emission Strength"].default_value = strength
    if rim:  # fresnel-driven emission so the dark body reads against a dark background
        lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.35
        pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 2.0
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = rim
        mu = nt.nodes.new("ShaderNodeMath"); mu.name = "rim"; mu.operation = "MULTIPLY"; mu.inputs[1].default_value = rim_str
        add = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(lw.outputs["Facing"], pw.inputs[0])
        nt.links.new(pw.outputs[0], mu.inputs[0])
        nt.links.new(mu.outputs[0], em.inputs["Strength"])
        out = nt.nodes["Material Output"]
        nt.links.new(p.outputs[0], add.inputs[0]); nt.links.new(em.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs["Surface"])
    m.use_backface_culling = cull
    return m

def glow(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = color
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m

M = {
    "body": mat("body", INK, 0.55, 0.15, rim=PURPLE_SOFT, rim_str=0.9),
    "body_light": mat("body_light", WHITE, 0.3, 0.0, emit=WHITE, strength=1.6, rim=ICE, rim_str=3.0),
    "cloth": mat("cloth", hx("#120A24"), 0.8, 0.0, rim=PURPLE_HI, rim_str=0.7),
    "cloth_light": mat("cloth_light", PURPLE_SOFT, 0.5, 0.0, emit=PURPLE_SOFT, strength=0.9, rim=ICE, rim_str=2.5),
    "armor": mat("armor", PURPLE, 0.3, 0.8, rim=PURPLE_SOFT, rim_str=1.2),
    "armor_light": mat("armor_light", WHITE, 0.15, 0.9, emit=ICE, strength=1.2, rim=WHITE, rim_str=4.0),
    "ice": glow("ice", ICE, 8.0),
    "ice_soft": glow("ice_soft", ICE, 3.0),
    "violet": glow("violet", PURPLE_SOFT, 4.0),
    "white": glow("white", WHITE, 10.0),
    "wingfill": mat("wingfill", PURPLE, 0.4, 0.0, emit=PURPLE_HI, strength=0.9),
    "aura": glow("aura", ICE, 1.8),
}
M["aura"].use_backface_culling = True

# ---- helpers --------------------------------------------------------------
pivot = bpy.data.objects.new("Pivot", None); col.objects.link(pivot)  # turntable
lift = bpy.data.objects.new("Lift", None); col.objects.link(lift); lift.parent = pivot  # float offset

def tag(o, tier, until=99, parent=None, light=None):
    o["tier"], o["until"] = tier, until
    if light: o["dark"], o["light"] = o.data.materials[0].name, light
    o.parent = parent or lift
    return o

def mesh_obj(name, bm, material, flat=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = not flat
    me.materials.append(material)
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    return o

def limb(bm, a, b, r1, r2, seg=8):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    m.translation = (a + b) / 2
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length, matrix=m)

def blob(bm, c, s, sub=2, rot=None):
    m = Matrix.Translation(c) @ Matrix.Diagonal((*s, 1))
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=m)

def octa(bm, c, rxy, rz, rot=0.0):
    c = Vector(c)
    vs = [bm.verts.new(c + Vector(v)) for v in
          [(rxy * math.cos(rot + k * math.pi / 2), rxy * math.sin(rot + k * math.pi / 2), 0) for k in range(4)]
          + [(0, 0, rz), (0, 0, -rz)]]
    for k in range(4):
        a, b = vs[k], vs[(k + 1) % 4]
        bm.faces.new((a, b, vs[4])); bm.faces.new((b, a, vs[5]))

def bevel(o, w=0.006):
    md = o.modifiers.new("bev", "BEVEL"); md.width = w; md.segments = 1; md.limit_method = "ANGLE"

# ---- body (one mesh, faceted low-poly) ------------------------------------
bm = bmesh.new()
blob(bm, (0, 0, 1.80), (0.115, 0.125, 0.145), sub=2)          # head (faceless)
limb(bm, (0, 0, 1.60), (0, 0, 1.70), 0.05, 0.045)                # neck
limb(bm, (0, 0, 1.12), (0, 0, 1.62), 0.14, 0.22, seg=8)         # V torso
limb(bm, (0, 0, 0.96), (0, 0, 1.16), 0.15, 0.145, seg=8)        # pelvis
for s in (-1, 1):
    limb(bm, (s * 0.09, 0, 0.98), (s * 0.10, 0, 0.53), 0.08, 0.055)      # thigh
    limb(bm, (s * 0.10, 0, 0.53), (s * 0.11, 0.01, 0.07), 0.055, 0.035)  # shin
    blob(bm, (s * 0.11, -0.04, 0.04), (0.05, 0.10, 0.04), sub=1)          # foot
    blob(bm, (s * 0.25, 0, 1.55), (0.07, 0.07, 0.07), sub=1)              # shoulder
    limb(bm, (s * 0.26, 0, 1.53), (s * 0.31, 0.01, 1.24), 0.055, 0.045)  # upper arm
    limb(bm, (s * 0.31, 0.01, 1.24), (s * 0.34, -0.02, 0.97), 0.045, 0.035)  # forearm
    blob(bm, (s * 0.345, -0.025, 0.92), (0.035, 0.03, 0.055), sub=1)      # hand
body = tag(mesh_obj("Body", bm, M["body"]), 0, light="body_light")
body.data.materials.append(M["aura"])
bevel(body, 0.004)
aura = body.modifiers.new("aura", "SOLIDIFY")  # inverted hull = glowing outline (tier 9+)
aura.thickness = -0.015; aura.offset = 1.0; aura.use_flip_normals = True; aura.material_offset = 1
aura.use_rim = False

# ---- tier 1: eye slits ----------------------------------------------------
for s in (-1, 1):
    bm = bmesh.new()
    m = Matrix.Translation((s * 0.045, -0.112, 1.815)) @ Matrix.Rotation(s * -0.18, 4, "Y") @ Matrix.Diagonal((0.032, 0.012, 0.007, 1))
    bmesh.ops.create_cube(bm, size=2.0, matrix=m)
    tag(mesh_obj(f"Eye{s}", bm, M["ice"]), 1)

# ---- tier 2: chest core ---------------------------------------------------
bm = bmesh.new(); octa(bm, (0, -0.19, 1.43), 0.05, 0.085, rot=math.pi / 4)
tag(mesh_obj("Core", bm, M["ice"]), 2)

# ---- tier 3: hood + cape --------------------------------------------------
bm = bmesh.new()
blob(bm, (0, 0.02, 1.80), (0.16, 0.165, 0.2), sub=2)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y < -0.07 and f.calc_center_median().z < 1.93], context="FACES")
blob(bm, (0, 0.02, 1.62), (0.2, 0.15, 0.07), sub=1)  # hood collar draping onto shoulders
hood = tag(mesh_obj("Hood", bm, M["cloth"]), 3, until=9, light="cloth_light")
sm = hood.modifiers.new("sol", "SOLIDIFY"); sm.thickness = 0.012

bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=False, segments=14, radius1=0.42, radius2=0.25, depth=1.45,
                      matrix=Matrix.Translation((0, 0.06, 0.88)))
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y < 0.02], context="FACES")
cape = tag(mesh_obj("Cape", bm, M["cloth"]), 3, light="cloth_light")
sm = cape.modifiers.new("sol", "SOLIDIFY"); sm.thickness = 0.012
cape.scale = (1.0, 0.8, 1.0)

# ---- tier 4: shoulder armour ----------------------------------------------
for s in (-1, 1):
    bm = bmesh.new()
    blob(bm, (s * 0.27, 0, 1.58), (0.12, 0.11, 0.07), sub=1)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 1.555], context="VERTS")
    plate = tag(mesh_obj(f"Pauldron{s}", bm, M["armor"]), 4, light="armor_light")
    sm = plate.modifiers.new("sol", "SOLIDIFY"); sm.thickness = 0.02
    bevel(plate)
    bm = bmesh.new()  # glowing trim along the plate edge
    bmesh.ops.create_cone(bm, cap_ends=False, segments=10, radius1=0.12, radius2=0.12, depth=0.008,
                          matrix=Matrix.Translation((s * 0.27, 0, 1.556)) @ Matrix.Diagonal((1, 0.92, 1, 1)))
    trim = tag(mesh_obj(f"Trim{s}", bm, M["ice_soft"]), 4)
    sm = trim.modifiers.new("sol", "SOLIDIFY"); sm.thickness = 0.008

# ---- tier 5: ring behind the back -----------------------------------------
def ring(name, r, minor, loc, rot, material, tier, until=99, seg=64, rs=6):
    bm = bmesh.new()
    loops = [[bm.verts.new(((r + minor * math.cos(b)) * math.cos(a), (r + minor * math.cos(b)) * math.sin(a), minor * math.sin(b)))
              for b in (2 * math.pi * j / rs for j in range(rs))] for a in (2 * math.pi * i / seg for i in range(seg))]
    for i in range(seg):
        for j in range(rs):
            l1, l2 = loops[i], loops[(i + 1) % seg]
            bm.faces.new((l1[j], l2[j], l2[(j + 1) % rs], l1[(j + 1) % rs]))
    o = mesh_obj(name, bm, material, flat=False)
    o.location, o.rotation_euler = loc, rot
    return tag(o, tier, until)
ring("Ring", 0.48, 0.02, (0, 0.28, 1.5), (math.pi / 2, 0, 0), M["ice"], 5)

# ---- tier 6: orbiting shards (fixed, they spin with the turntable) ---------
for k, (ang, z) in enumerate([(40, 1.55), (140, 0.95), (220, 1.35), (320, 0.7)]):
    a = math.radians(ang)
    bm = bmesh.new(); octa(bm, (0.68 * math.cos(a), 0.68 * math.sin(a), z), 0.035, 0.1, rot=a)
    o = tag(mesh_obj(f"Shard{k}", bm, M["ice"] if k % 2 == 0 else M["violet"]), 6)
    o.rotation_euler = (0.25, 0, 0)

# ---- tier 7: crown of light points ----------------------------------------
bm = bmesh.new()
for k in range(7):
    a = math.pi / 2 + (k - 3) * 0.42 - math.pi  # arc over the front/sides
    a = -math.pi / 2 + (k - 3) * (2 * math.pi / 7)
    h = 0.13 if k == 3 else (0.1 if k in (2, 4) else 0.07)
    base = Vector((0.12 * math.cos(a), 0.12 * math.sin(a), 2.06))
    tip = base + Vector((0.035 * math.cos(a), 0.035 * math.sin(a), h))
    limb(bm, base, tip, 0.022, 0.0, seg=4)
tag(mesh_obj("Crown", bm, M["ice"]), 7)
ring("CrownBand", 0.12, 0.01, (0, 0, 2.06), (0, 0, 0), M["ice_soft"], 7)

# ---- tier 8: crystalline wings --------------------------------------------
for s in (-1, 1):
    fill, edge = bmesh.new(), bmesh.new()
    for k, (ang, L, w) in enumerate([(55, 0.85, 0.09), (35, 0.8, 0.085), (15, 0.65, 0.075), (-5, 0.45, 0.06)]):
        a = math.radians(ang)
        u, v = Vector((math.cos(a), 0, math.sin(a))), Vector((-math.sin(a), 0, math.cos(a)))
        pts = [Vector((0, 0, 0)), u * L * 0.3 + v * w, u * L, u * L * 0.3 - v * w]
        for b in (fill, edge):
            vs = [b.verts.new(p) for p in pts]; b.faces.new(vs)
    rot = Matrix.Translation((s * 0.12, 0.13, 1.45)) @ Matrix.Rotation(math.radians(-38 * s), 4, "Z") @ Matrix.Diagonal((s, 1, 1, 1))
    for b in (fill, edge): bmesh.ops.transform(b, matrix=rot, verts=b.verts)
    if s < 0:
        for b in (fill, edge): bmesh.ops.reverse_faces(b, faces=b.faces)
    f = tag(mesh_obj(f"Wing{s}", fill, M["wingfill"]), 8, light="body_light")
    sm = f.modifiers.new("sol", "SOLIDIFY"); sm.thickness = 0.01
    e = tag(mesh_obj(f"WingEdge{s}", edge, M["ice"]), 8)
    wm = e.modifiers.new("wire", "WIREFRAME"); wm.thickness = 0.014; wm.use_boundary = True

# ---- tier 9: float, aura outline, ground ring -----------------------------
ring("Ground", 0.48, 0.012, (0, 0, 0.005), (0, 0, 0), M["ice_soft"], 9, )["static"] = 1
ring("Ground2", 0.3, 0.008, (0, 0, 0.005), (0, 0, 0), M["violet"], 9)["static"] = 1
for n in ("Ground", "Ground2"): bpy.data.objects[n].parent = None

# ---- tier 10: second ring -------------------------------------------------
ring("Ring2", 0.6, 0.014, (0, 0.32, 1.5), (math.pi / 2, math.radians(25), 0), M["white"], 10)

# ---- camera + lights ------------------------------------------------------
target = Vector((0, 0, 1.2))
pitch = math.radians(6)  # slightly below eye level, looking up = heroic
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"; cam_data.ortho_scale = 2.7
cam = bpy.data.objects.new("Cam", cam_data); col.objects.link(cam)
cam.location = target + Vector((0, -10 * math.cos(pitch), -10 * math.sin(pitch)))
cam.rotation_euler = (math.pi / 2 + pitch, 0, 0)
scene.camera = cam

def light(name, kind, energy, color, loc, size=1.0):
    d = bpy.data.lights.new(name, kind); d.energy = energy; d.color = color[:3]
    if kind == "AREA": d.size = size
    o = bpy.data.objects.new(name, d); col.objects.link(o); o.location = loc
    o.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o
light("RimBlue", "AREA", 450, ICE, (-1.8, 2.2, 2.3), 1.5)
light("RimPurple", "AREA", 500, PURPLE_SOFT, (1.9, 2.0, 1.4), 1.5)
light("Key", "AREA", 70, hx("#C9C2E8"), (1.2, -2.5, 2.6), 2.0)
light("Under", "AREA", 30, PURPLE_HI, (0, -1.5, -0.3), 1.0)

world = bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = hx("#120A24")
world.node_tree.nodes["Background"].inputs[1].default_value = 0.4

# ---- render settings ------------------------------------------------------
r = scene.render
r.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 24
r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
r.film_transparent = True
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
r.image_settings.file_format = "WEBP"
r.image_settings.color_mode = "RGBA"
r.image_settings.quality = 80

# Bloom: glare on highlights, then alpha = max(alpha, glow luminance) so the halo
# survives on transparent pixels (the render is premultiplied, so this stays correct).
tree = bpy.data.node_groups.new("Bloom", "CompositorNodeTree")
tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
scene.compositing_node_group = tree
N, L = tree.nodes, tree.links
rl = N.new("CompositorNodeRLayers")
gl = N.new("CompositorNodeGlare")
gl.inputs["Type"].default_value = "Bloom"
gl.inputs["Quality"].default_value = "High"
gl.inputs["Threshold"].default_value = 0.8
gl.inputs["Strength"].default_value = 0.6
gl.inputs["Size"].default_value = 0.55
sep = N.new("CompositorNodeSeparateColor")
lum = N.new("CompositorNodeRGBToBW")
mx = N.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
mn = N.new("ShaderNodeMath"); mn.operation = "MINIMUM"; mn.inputs[1].default_value = 1.0
sa = N.new("CompositorNodeSetAlpha")
out = N.new("NodeGroupOutput")
L.new(rl.outputs["Image"], gl.inputs["Image"])
L.new(rl.outputs["Image"], sep.inputs[0])
L.new(gl.outputs["Glare"], lum.inputs[0])
L.new(sep.outputs["Alpha"], mx.inputs[0]); L.new(lum.outputs[0], mx.inputs[1])
L.new(mx.outputs[0], mn.inputs[0])
L.new(gl.outputs["Image"], sa.inputs["Image"]); L.new(mn.outputs[0], sa.inputs["Alpha"])
sa.inputs["Type"].default_value = "Replace Alpha"
L.new(sa.outputs[0], out.inputs[0])

# ---- per-tier state -------------------------------------------------------
def set_tier(t):
    for o in bpy.data.objects:
        if "tier" not in o: continue
        o.hide_render = not (o["tier"] <= t <= o["until"])
        if "light" in o:
            o.data.materials[0] = M[o["light"]] if t >= 10 else bpy.data.materials[o["dark"]]
    lift.location.z = 0.18 if t >= 9 else 0.0
    aura.show_render = t >= 9
    # dormant form is dimmer: weaker rim lights
    bpy.data.lights["RimBlue"].energy = 250 if t == 0 else 450
    bpy.data.lights["RimPurple"].energy = 280 if t == 0 else 500
    M["body"].node_tree.nodes["rim"].inputs[1].default_value = 0.35 if t == 0 else 0.9
    gl.inputs["Strength"].default_value = 0.6 if t < 9 else 0.9

# ---- render loop ----------------------------------------------------------
t0 = time.time()
for t in TIERS:
    set_tier(t)
    os.makedirs(os.path.join(OUT, f"t{t}"), exist_ok=True)
    for f in FRAME_LIST:
        pivot.rotation_euler.z = math.radians(15 * f)
        r.filepath = os.path.join(OUT, f"t{t}", f"{f:02d}.webp")
        bpy.ops.render.render(write_still=True)
    print(f"[forms] tier {t} done, {time.time() - t0:.0f}s elapsed", flush=True)
print(f"[forms] RENDER_SECONDS {time.time() - t0:.1f}", flush=True)

# ---- formFrames.ts --------------------------------------------------------
if FULL:
    lines = ["// Generated by blender/forms.py. Do not edit.", "export const FORM_FRAMES: number[][] = ["]
    for t in range(11):
        reqs = ", ".join(f"require('../../assets/forms/t{t}/{f:02d}.webp')" for f in range(FRAMES))
        lines.append(f"  [{reqs}],")
    lines.append("];\n")
    with open(os.path.join(APP, "src", "ui", "formFrames.ts"), "w", newline="\n") as fh:
        fh.write("\n".join(lines))

# ---- contact sheet --------------------------------------------------------
if SHEET:
    import numpy as np
    tw, th = W // 2, H // 2
    tiers = sorted(int(d[1:]) for d in os.listdir(OUT) if d.startswith("t") and d[1:].isdigit())
    sheet = np.zeros((th * 2, tw * len(tiers), 4), dtype=np.float32)
    sheet[...] = (3 / 255, 3 / 255, 8 / 255, 1)
    for i, t in enumerate(tiers):
        for j, f in enumerate((0, 6)):
            p = os.path.join(OUT, f"t{t}", f"{f:02d}.webp")
            if not os.path.exists(p): continue
            img = bpy.data.images.load(p); img.colorspace_settings.name = "Non-Color"
            px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
            px = px.reshape(th, 2, tw, 2, 4).mean(axis=(1, 3))
            a = px[..., 3:4]
            y0 = (1 - j) * th  # pixel rows run bottom-up
            tile = sheet[y0:y0 + th, i * tw:(i + 1) * tw]
            tile[..., :3] = tile[..., :3] * (1 - a) + px[..., :3] * a
    out_img = bpy.data.images.new("sheet", sheet.shape[1], sheet.shape[0], alpha=True)
    out_img.colorspace_settings.name = "Non-Color"
    out_img.pixels = sheet.ravel()
    out_img.filepath_raw = SHEET; out_img.file_format = "PNG"; out_img.save()
    print(f"[forms] sheet -> {SHEET}", flush=True)
