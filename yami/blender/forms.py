# Yami character forms: builds the character in Blender and renders the turntables, per theme.
#
# Full run (5 themes x 11 tiers x 24 frames -> assets/forms/{theme}/t*/NN.webp + src/ui/formFrames.ts):
#   "D:\Tools\blender-5.2.0-windows-x64\blender.exe" --factory-startup -b -P "D:\My Apps\Yami\yami\blender\forms.py"
# One theme (comma list ok, default all; formFrames.ts still lists every theme):
#   ... -P forms.py -- --theme sakura
# Preview run (subset, into another folder, no .ts written):
#   blender.exe --factory-startup -b -P forms.py -- --theme ember --tiers 0,5,10 --frames 0,6 --out C:\some\dir
# Contact sheets (frame 00 + 06 per tier on the theme's app bg): add  --sheet C:\dir  -> C:\dir\forms-sheet-{theme}.png
# Always pass --factory-startup (a user add-on otherwise loads). One Blender at a time: low-memory laptop.
#
# Pure built-in primitives/modifiers, EEVEE, no add-ons. Upgrades are cumulative: every
# object carries a "tier" (first tier it appears) and optional "until" (last tier it shows).
import bpy, bmesh, math, os, random, sys, time
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

# ---- themes ---------------------------------------------------------------
def hx(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*c, a)

# ink = darkest body base, cloth = hood/cape, armor = matte base colour, hi = deep accent,
# soft = secondary glow/trim, glow = emissive accent, white = tier-10 "light" form, bg = app background.
# Optional: rim_k (coloured back lights), key_k (front key light), glare (bloom, 0 = off),
# body_rim (body fresnel), glow_k (emissive strength), outline (toon outline at every tier).
# darkness is the original look: keep its values and defaults untouched.
THEMES = {
    "darkness": dict(ink="#0B0816", cloth="#120A24", armor="#2A1252", hi="#6B3BD9", soft="#9B78F2", glow="#8FDCFF",
                     white="#F2F0F7", key="#C9C2E8", world="#120A24", bg="#030308", motif=None),
    "sakura": dict(ink="#FFF5F8", cloth="#F7C6D6", armor="#E8578A", hi="#B8325F", soft="#F4A6C0", glow="#E8578A",
                   white="#F4A6C0", key="#FFFFFF", world="#F7C6D6", bg="#FFF5F8", motif="petal",
                   rim_k=0.25, key_k=1.6, glare=0.0, body_rim=0.4, glow_k=0.15, outline="#8E2A50"),
    "abyss": dict(ink="#04161D", cloth="#06202A", armor="#0B3442", hi="#1A8C9C", soft="#2FB8C8", glow="#3FE0D0",
                  white="#E6FBFA", key="#BFE6EA", world="#06202A", bg="#02090F", motif="bubble"),
    "ember": dict(ink="#140904", cloth="#1E0E05", armor="#3A1A08", hi="#B4561C", soft="#E07B39", glow="#FFB347",
                  white="#FFF3E0", key="#EBD2B8", world="#1E0E05", bg="#0A0604", motif="spark"),
    "jade": dict(ink="#04140E", cloth="#072118", armor="#0F3A2A", hi="#25875A", soft="#3FBF85", glow="#6FE3A8",
                 white="#EEFFF5", key="#C4E8D4", world="#072118", bg="#04100B", motif="leaf"),
}
def cols(P): return {k: hx(v) for k, v in P.items() if isinstance(v, str) and v.startswith("#")}
TH_ARG = arg("--theme", "all")
THEME_LIST = list(THEMES) if TH_ARG == "all" else TH_ARG.split(",")
for th in THEME_LIST: assert th in THEMES, f"unknown theme {th}"

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

def build_materials(P):
    c, gk = cols(P), P.get("glow_k", 1.0)
    M = {
        "body": mat("body", c["ink"], 0.55, 0.15, rim=c["soft"], rim_str=0.9),
        "body_light": mat("body_light", c["white"], 0.3, 0.0, emit=c["white"], strength=1.6 * gk, rim=c["glow"], rim_str=3.0 * gk),
        "cloth": mat("cloth", c["cloth"], 0.8, 0.0, rim=c["hi"], rim_str=0.7 * gk),
        "cloth_light": mat("cloth_light", c["soft"], 0.5, 0.0, emit=c["soft"], strength=0.9 * gk, rim=c["glow"], rim_str=2.5 * gk),
        "armor": mat("armor", c["armor"], 0.3, 0.8, rim=c["soft"], rim_str=1.2 * gk),
        "armor_light": mat("armor_light", c["white"], 0.15, 0.9, emit=c["glow"], strength=1.2 * gk, rim=c["white"], rim_str=4.0 * gk),
        "ice": glow("ice", c["glow"], 8.0 * gk),
        "ice_soft": glow("ice_soft", c["glow"], 3.0 * gk),
        "violet": glow("violet", c["soft"], 4.0 * gk),
        "white": glow("white", c["white"], 10.0 * gk),
        "wingfill": mat("wingfill", c["armor"], 0.4, 0.0, emit=c["hi"], strength=0.9),
        # dark themes: glowing aura hull (tier 9+); light themes: flat toon outline at every tier
        "aura": glow("aura", c["outline"], 1.0) if "outline" in c else glow("aura", c["glow"], 1.8),
        # motifs
        "petal": mat("petal", hx("#FFD3E1"), 0.6, 0.0, emit=hx("#F7A8C4"), strength=0.25),
        "petal_edge": glow("petal_edge", hx("#C2416F"), 1.0),
        "bubble": mat("bubble", c["ink"], 0.1, 0.0, rim=c["glow"], rim_str=4.0),
        "spark": glow("spark", c["glow"], 9.0),
        "spark2": glow("spark2", c["soft"], 6.0),
        "leaf": mat("leaf", c["hi"], 0.5, 0.0, emit=c["soft"], strength=1.2, rim=c["glow"], rim_str=2.0),
    }
    M["aura"].use_backface_culling = True
    return M

M = build_materials(THEMES[THEME_LIST[0]])

def apply_materials(P):
    """Swap every material for the theme's version under the same name (keeps the 'dark'/'light' tags valid)."""
    global M
    new = build_materials(P)
    for k, m in new.items():
        old = M[k]; old.user_remap(m); bpy.data.materials.remove(old); m.name = k
    M = new

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

# ---- theme motifs: small, spin with the turntable, count grows with tier --
# 12 per theme; motif k first shows at MOTIF_TIERS[k] -> 2 at tier 0, 12 at tier 10.
MOTIF_TIERS = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
def flower(bm, R):  # 5-petal blossom, flat on XY
    n = 40
    c = bm.verts.new((0, 0, 0))
    rim = [bm.verts.new((R * (0.35 + 0.65 * abs(math.cos(2.5 * a))) * math.cos(a),
                         R * (0.35 + 0.65 * abs(math.cos(2.5 * a))) * math.sin(a), 0))
           for a in (2 * math.pi * i / n for i in range(n))]
    for i in range(n): bm.faces.new((c, rim[i], rim[(i + 1) % n]))
def leaf(bm, L, w):  # pointed lens, flat on XY, along +X
    n = 8
    top = [bm.verts.new((L * i / n, w * math.sin(math.pi * i / n) ** 0.8, 0)) for i in range(n + 1)]
    bot = [bm.verts.new((L * i / n, -w * math.sin(math.pi * i / n) ** 0.8, 0)) for i in range(1, n)]
    bm.faces.new(top + bot[::-1])
for th, P in THEMES.items():
    kind = P["motif"]
    if not kind: continue
    rng = random.Random(th)  # str seeds are deterministic across runs
    for k, tier in enumerate(MOTIF_TIERS):
        a = k * 2.39996 + rng.uniform(-0.2, 0.2)  # golden-angle spread around the figure
        rad = rng.uniform(0.5, 0.7)
        z = 0.35 + (k * 0.618 % 1.0) * 1.75
        bm = bmesh.new()
        if kind == "petal":
            flower(bm, rng.uniform(0.045, 0.06)); m0 = M["petal"]
        elif kind == "leaf":
            leaf(bm, rng.uniform(0.09, 0.12), 0.03); m0 = M["leaf"]
        elif kind == "bubble":
            r_ = rng.uniform(0.022, 0.04); blob(bm, (0, 0, 0), (r_, r_, r_), sub=2); m0 = M["bubble"]
        else:  # spark: thin vertical diamond; sparks rise, so they sit a bit higher
            octa(bm, (0, 0, 0), 0.012, rng.uniform(0.03, 0.045)); m0 = M["spark"] if k % 3 else M["spark2"]
            z = 0.6 + (k * 0.618 % 1.0) * 1.6
        o = mesh_obj(f"Motif_{th}_{k}", bm, m0, flat=kind != "bubble")
        o.location = (rad * math.cos(a), rad * math.sin(a), z)
        if kind in ("petal", "leaf"):
            o.rotation_euler = (rng.uniform(0.6, 1.3), rng.uniform(-0.6, 0.6), rng.uniform(0, 6.28))
            sm = o.modifiers.new("sol", "SOLIDIFY"); sm.thickness = 0.004
        if kind == "petal":  # dark rose rim so petals read on the light background
            o.data.materials.append(M["petal_edge"])
            ol = o.modifiers.new("outline", "SOLIDIFY"); ol.thickness = -0.006; ol.offset = 1.0
            ol.use_flip_normals = True; ol.material_offset = 1
        tag(o, tier)["theme"] = th

# ---- camera + lights ------------------------------------------------------
target = Vector((0, 0, 1.2))
pitch = math.radians(6)  # slightly below eye level, looking up = heroic
cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"; cam_data.ortho_scale = 2.7
cam = bpy.data.objects.new("Cam", cam_data); col.objects.link(cam)
cam.location = target + Vector((0, -10 * math.cos(pitch), -10 * math.sin(pitch)))
cam.rotation_euler = (math.pi / 2 + pitch, 0, 0)
scene.camera = cam

def light(name, kind, energy, loc, size=1.0):
    d = bpy.data.lights.new(name, kind); d.energy = energy
    if kind == "AREA": d.size = size
    o = bpy.data.objects.new(name, d); col.objects.link(o); o.location = loc
    o.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o
light("RimBlue", "AREA", 450, (-1.8, 2.2, 2.3), 1.5)    # colour = theme glow
light("RimPurple", "AREA", 500, (1.9, 2.0, 1.4), 1.5)   # colour = theme soft
light("Key", "AREA", 70, (1.2, -2.5, 2.6), 2.0)
light("Under", "AREA", 30, (0, -1.5, -0.3), 1.0)        # colour = theme hi

world = bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
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

# ---- per-theme / per-tier state -------------------------------------------
TH = {}
def set_theme(name):
    P = THEMES[name]
    TH.clear(); TH.update(P); TH["name"] = name
    apply_materials(P)
    c, Ls = cols(P), bpy.data.lights
    Ls["RimBlue"].color, Ls["RimPurple"].color = c["glow"][:3], c["soft"][:3]
    Ls["Key"].color, Ls["Under"].color = c["key"][:3], c["hi"][:3]
    Ls["Key"].energy = 70 * P.get("key_k", 1.0)
    world.node_tree.nodes["Background"].inputs[0].default_value = c["world"]

def set_tier(t):
    for o in bpy.data.objects:
        if "tier" not in o: continue
        o.hide_render = not (o["tier"] <= t <= o["until"]) or o.get("theme", TH["name"]) != TH["name"]
        if "light" in o:
            o.data.materials[0] = M[o["light"]] if t >= 10 else bpy.data.materials[o["dark"]]
    lift.location.z = 0.18 if t >= 9 else 0.0
    outline = "outline" in TH  # light themes: thin toon outline at every tier
    aura.show_render = t >= 9 or outline
    aura.thickness = (-0.011 if t >= 9 else -0.008) if outline else -0.015
    # dormant form is dimmer: weaker rim lights
    rk = TH.get("rim_k", 1.0)
    bpy.data.lights["RimBlue"].energy = (250 if t == 0 else 450) * rk
    bpy.data.lights["RimPurple"].energy = (280 if t == 0 else 500) * rk
    M["body"].node_tree.nodes["rim"].inputs[1].default_value = (0.35 if t == 0 else 0.9) * TH.get("body_rim", 1.0)
    gl.inputs["Strength"].default_value = (0.6 if t < 9 else 0.9) * TH.get("glare", 1.0)

# ---- render loop ----------------------------------------------------------
t0 = time.time()
for th in THEME_LIST:
    set_theme(th)
    for t in TIERS:
        set_tier(t)
        os.makedirs(os.path.join(OUT, th, f"t{t}"), exist_ok=True)
        for f in FRAME_LIST:
            pivot.rotation_euler.z = math.radians(15 * f)
            r.filepath = os.path.join(OUT, th, f"t{t}", f"{f:02d}.webp")
            bpy.ops.render.render(write_still=True)
        print(f"[forms] {th} tier {t} done, {time.time() - t0:.0f}s elapsed", flush=True)
print(f"[forms] RENDER_SECONDS {time.time() - t0:.1f}", flush=True)

# ---- formFrames.ts (lists every theme, whichever were rendered this run) ---
if FULL:
    lines = ["// Generated by blender/forms.py. Do not edit.",
             "export type ThemeId = " + " | ".join(f"'{t}'" for t in THEMES) + ";",
             "export const THEME_FRAMES: Record<ThemeId, number[][]> = {"]
    for th in THEMES:
        lines.append(f"  {th}: [")
        for t in range(11):
            reqs = ", ".join(f"require('../../assets/forms/{th}/t{t}/{f:02d}.webp')" for f in range(FRAMES))
            lines.append(f"    [{reqs}],")
        lines.append("  ],")
    lines += ["};", "export const FORM_FRAMES: number[][] = THEME_FRAMES.darkness;", ""]
    with open(os.path.join(APP, "src", "ui", "formFrames.ts"), "w", newline="\n") as fh:
        fh.write("\n".join(lines))

# ---- contact sheets -------------------------------------------------------
if SHEET:
    import numpy as np
    tw, thh = W // 2, H // 2
    for th in THEME_LIST:
        root = os.path.join(OUT, th)
        tiers = sorted(int(d[1:]) for d in os.listdir(root) if d.startswith("t") and d[1:].isdigit())
        sheet = np.zeros((thh * 2, tw * len(tiers), 4), dtype=np.float32)
        bg = THEMES[th]["bg"].lstrip("#")
        sheet[...] = (*(int(bg[i:i + 2], 16) / 255 for i in (0, 2, 4)), 1)
        for i, t in enumerate(tiers):
            for j, f in enumerate((0, 6)):
                p = os.path.join(root, f"t{t}", f"{f:02d}.webp")
                if not os.path.exists(p): continue
                img = bpy.data.images.load(p); img.colorspace_settings.name = "Non-Color"
                px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
                bpy.data.images.remove(img)
                px = px.reshape(thh, 2, tw, 2, 4).mean(axis=(1, 3))
                a = px[..., 3:4]
                y0 = (1 - j) * thh  # pixel rows run bottom-up
                tile = sheet[y0:y0 + thh, i * tw:(i + 1) * tw]
                tile[..., :3] = tile[..., :3] * (1 - a) + px[..., :3] * a
        out_img = bpy.data.images.new(f"sheet_{th}", sheet.shape[1], sheet.shape[0], alpha=True)
        out_img.colorspace_settings.name = "Non-Color"
        out_img.pixels = sheet.ravel()
        dst = os.path.join(SHEET, f"forms-sheet-{th}.png")
        out_img.filepath_raw = dst; out_img.file_format = "PNG"; out_img.save()
        bpy.data.images.remove(out_img)
        print(f"[forms] sheet -> {dst}", flush=True)
