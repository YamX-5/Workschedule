# Yami character forms: a procedural dark-fantasy shadow warrior, 11 tiers x 5 themes, turntable sprites.
#
# One theme per Blender process (memory: the laptop crashed rendering all five in one process):
#   "D:\Tools\blender-5.2.0-windows-x64\blender.exe" --factory-startup -b -P "D:\My Apps\Yami\yami\blender\forms.py" -- --theme darkness
# Each full run writes assets/forms/{theme}/t*/NN.webp and regenerates src/ui/formFrames.ts (lists every theme).
# Preview (subset, other folder, no .ts):  ... -- --theme ember --tiers 0,5,10 --frames 0,6 --out C:\dir
# Contact sheet (frames 00 + 06 of every rendered tier on the theme's app bg):  add  --sheet C:\dir  -> C:\dir\{theme}.png
#
# Built only from Blender's procedural tools, no add-ons, no external assets:
#   body = Skin-modifier skeleton + subdivision; armour = shells grown off the body surface (solidify + bevel);
#   cloak / capes / scarf = cloth simulation against the body, baked to static meshes; tattered hems = noise alpha cut;
#   wings = skin-modifier spars + billowed membrane panels; aura = static camera-facing noise planes + embers.
# Every character object carries "tier" (first tier shown) and "until" (last tier shown).
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
THEME = arg("--theme", "darkness")
BLOOM = float(arg("--bloom", "0.4"))  # bloom strength (tuning knob)
WIND = float(arg("--wind", "1500"))  # cloth wind strength (tuning knob)

# ---- themes ---------------------------------------------------------------
def hx(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*c, a)

# cloth = cloak/cape, cloth2 = scarf / inner, suit = body suit, leather, metal = armour, trim = armour accents,
# glow = eyes/runes/aura, glow2 = hot core, deep = dark glow, smoke = dark aura body, rim1/rim2 = back lights,
# key = key light, bg = app background. aura = 'smoke' | 'petal' | 'abyss' | 'spark' | 'leaf'.
THEMES = {
    "darkness": dict(cloth="#120D1C", cloth2="#2A1252", suit="#08070B", leather="#2B1D2A", metal="#2E2A38", trim="#3B1A72",
                     glow="#9B5CFF", glow2="#B48CFF", deep="#6B3BD9", smoke="#0E0618", rim1="#9B5CFF", rim2="#6B3BD9",
                     key="#E8E6EE", bg="#030308", aura="smoke", metallic=0.85),
    "sakura": dict(cloth="#F7C6D6", cloth2="#B8336A", suit="#E6D8DE", leather="#C98AA2", metal="#FFF5F8", trim="#F7C6D6", rimk=0.25,
                   glow="#B8336A", glow2="#E8578A", deep="#8E2A50", smoke="#F7C6D6", rim1="#F4A6C0", rim2="#E8578A",
                   key="#FFFFFF", bg="#FFF5F8", aura="petal", metallic=0.35, outline="#7A2245", light=True),
    "abyss": dict(cloth="#04121A", cloth2="#0B3442", suit="#030A0F", leather="#0A2430", metal="#123341", trim="#0E5A66",
                  glow="#3FE0D0", glow2="#9FF7EE", deep="#14808C", smoke="#010407", rim1="#3FE0D0", rim2="#14808C",
                  key="#BFE6EA", bg="#02090F", aura="abyss", metallic=0.85),
    "ember": dict(cloth="#16100D", cloth2="#5A2E12", suit="#0E0A08", leather="#3A2414", metal="#5A3E24", trim="#9C6A32",
                  glow="#FFB347", glow2="#FFE0A0", deep="#E0662A", smoke="#120804", rim1="#FFB347", rim2="#E0662A",
                  key="#F0DCC4", bg="#0A0604", aura="spark", metallic=0.9),
    "jade": dict(cloth="#07160F", cloth2="#0F3A2A", suit="#050E0A", leather="#14291E", metal="#1F3D31", trim="#25875A",
                 glow="#6FE3A8", glow2="#C2F7DC", deep="#25875A", smoke="#020B07", rim1="#6FE3A8", rim2="#25875A",
                 key="#CFE8DA", bg="#04100B", aura="leaf", metallic=0.8),
}
assert THEME in THEMES, f"unknown theme {THEME} (one theme per process)"
P = THEMES[THEME]
C = {k: hx(v) for k, v in P.items() if isinstance(v, str) and v.startswith("#")}
LIGHT = P.get("light", False)
rng = random.Random(1234)  # same layout for every theme

# ---- scene ----------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

# ---- shader helpers -------------------------------------------------------
class NB:
    """Tiny node-graph builder: NB(mat).n('ShaderNodeMath', operation='ADD') etc."""
    def __init__(self, m):
        self.m, self.nt = m, m.node_tree
        self.N, self.L = self.nt.nodes, self.nt.links
    def n(self, kind, **props):
        node = self.N.new(kind)
        for k, v in props.items(): setattr(node, k, v)
        return node
    def link(self, a, b): self.L.new(a, b)
    def put(self, sock, v):
        if isinstance(v, bpy.types.NodeSocket): self.link(v, sock)
        else: sock.default_value = v
    def math(self, op, a, b=0.0, clamp=False):
        node = self.n("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.put(node.inputs[0], a); self.put(node.inputs[1], b)
        return node.outputs[0]
    def noise(self, vec, scale, detail=4.0, rough=0.55, w=None):
        node = self.n("ShaderNodeTexNoise")
        if w is not None: node.noise_dimensions = "4D"; node.inputs["W"].default_value = w
        self.put(node.inputs["Vector"], vec); node.inputs["Scale"].default_value = scale
        node.inputs["Detail"].default_value = detail; node.inputs["Roughness"].default_value = rough
        return node.outputs["Fac"]
    def ramp(self, fac, stops):
        node = self.n("ShaderNodeValToRGB")
        self.put(node.inputs[0], fac)
        el = node.color_ramp.elements
        while len(el) < len(stops): el.new(0.5)
        for e, (pos, colr) in zip(el, stops):
            e.position = pos
            e.color = colr if isinstance(colr, tuple) and len(colr) == 4 else (colr, colr, colr, 1.0)
        return node.outputs[0]
    def coords(self, kind="Object"): return self.n("ShaderNodeTexCoord").outputs[kind]
    def sep(self, vec):
        node = self.n("ShaderNodeSeparateXYZ"); self.put(node.inputs[0], vec); return node.outputs
    def vec(self, x, y, z):
        node = self.n("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)): self.put(node.inputs[i], v)
        return node.outputs[0]
    def value(self, name, v):
        node = self.n("ShaderNodeValue"); node.name = name; node.outputs[0].default_value = v
        return node.outputs[0]
    def out(self, shader): self.link(shader, self.N["Material Output"].inputs["Surface"])

def new_mat(name, method="DITHERED"):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.surface_render_method = method
    return m, NB(m)

def principled(b, base, rough, metal=0.0, spec=0.5):
    p = b.N["Principled BSDF"]
    b.put(p.inputs["Base Color"], base); b.put(p.inputs["Roughness"], rough)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Specular IOR Level"].default_value = spec
    return p

def bump(b, p, height, strength, dist=0.01):
    bp = b.n("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = dist
    b.put(bp.inputs["Height"], height); b.link(bp.outputs[0], p.inputs["Normal"])

def tatter(b, shader, cut, amp, scale=9.0):
    """Hard alpha cut along the bottom of a UV'd cloth (UV.y = 0 at the hem): ragged, holed hem."""
    uv = b.sep(b.coords("UV"))
    nz = b.noise(b.coords("Object"), scale, 6.0, 0.65)
    nz2 = b.noise(b.coords("Object"), scale * 3.1, 3.0, 0.5)
    edge = b.math("ADD", uv[1], b.math("MULTIPLY", b.math("SUBTRACT", nz, 0.5), amp))
    keep = b.math("GREATER_THAN", edge, cut)
    holes = b.math("LESS_THAN", nz2, b.math("ADD", b.math("MULTIPLY", uv[1], 1.5), 0.64))  # a few moth holes near the hem
    keep = b.math("MINIMUM", keep, holes)
    tr = b.n("ShaderNodeBsdfTransparent"); mx = b.n("ShaderNodeMixShader")
    b.link(keep, mx.inputs[0]); b.link(tr.outputs[0], mx.inputs[1]); b.link(shader, mx.inputs[2])
    return mx.outputs[0]

def rim(b, p, k=None):
    """Stylised fresnel rim in the theme's deep glow: keeps dark shapes readable on a dark background."""
    lw = b.n("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.45
    p.inputs["Emission Color"].default_value = C["deep"]
    b.link(b.math("MULTIPLY", b.math("POWER", lw.outputs["Facing"], 4.0), P.get("rimk", 0.4) if k is None else k), p.inputs["Emission Strength"])

def cloth_mat(name, base, tattered=None):
    m, b = new_mat(name)
    o = b.coords("Object")
    weave = b.noise(o, 140.0, 2.0, 0.5)
    folds = b.noise(o, 7.0, 5.0, 0.6)
    tint = b.ramp(b.noise(o, 3.0, 3.0), [(0.3, tuple(x * 0.75 for x in base[:3]) + (1,)), (0.7, base)])
    p = principled(b, tint, 0.88, 0.0, 0.25)
    p.inputs["Sheen Weight"].default_value = 0.12
    bump(b, p, b.math("ADD", b.math("MULTIPLY", weave, 0.3), folds), 0.25)
    rim(b, p)
    sh = p.outputs[0]
    if tattered: sh = tatter(b, sh, *tattered)
    b.out(sh)
    return m

def leather_mat(name, base):
    m, b = new_mat(name)
    o = b.coords("Object")
    grain = b.noise(o, 90.0, 6.0, 0.7)
    wear = b.noise(o, 6.0, 4.0)
    tint = b.ramp(wear, [(0.35, tuple(x * 0.6 for x in base[:3]) + (1,)), (0.75, tuple(min(1, x * 1.5) for x in base[:3]) + (1,))])
    p = principled(b, tint, b.ramp(wear, [(0.3, 0.45), (0.8, 0.75)]), 0.0, 0.4)
    bump(b, p, grain, 0.3)
    rim(b, p)
    b.out(p.outputs[0])
    return m

def metal_mat(name, base, rune_color=None, rune=0.0, luminous=0.0):
    """Worn metal: roughness variation + fine scratches; optional emissive rune cracks (value node 'rune')."""
    m, b = new_mat(name)
    o = b.coords("Object")
    blotch = b.noise(o, 5.0, 5.0, 0.6)
    mp = b.n("ShaderNodeMapping"); b.link(o, mp.inputs["Vector"]); mp.inputs["Scale"].default_value = (300, 300, 20)
    scratch = b.noise(mp.outputs[0], 1.0, 2.0)
    tint = b.ramp(blotch, [(0.25, tuple(x * 0.7 for x in base[:3]) + (1,)), (0.8, tuple(min(1, x * 1.25) for x in base[:3]) + (1,))])
    rough = b.ramp(blotch, [(0.2, 0.14), (0.85, 0.48)])
    p = principled(b, tint, rough, P["metallic"], 0.6)
    bump(b, p, b.math("ADD", b.math("MULTIPLY", scratch, 0.2), b.math("MULTIPLY", blotch, 0.4)), 0.15)
    if rune_color is not None:
        vor = b.n("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE")
        b.link(o, vor.inputs["Vector"]); vor.inputs["Scale"].default_value = 5.0
        lines = b.math("LESS_THAN", vor.outputs["Distance"], 0.022)
        mask = b.math("GREATER_THAN", b.noise(o, 3.0, 2.0), 0.6)
        r = b.math("MULTIPLY", b.math("MULTIPLY", lines, mask), b.value("rune", rune))
        lum = b.value("lum", luminous)
        p.inputs["Emission Color"].default_value = rune_color
        b.link(b.math("ADD", r, lum), p.inputs["Emission Strength"])
    b.out(p.outputs[0])
    return m

def glow_mat(name, color, strength, method="DITHERED"):
    m, b = new_mat(name, method)
    b.N.remove(b.N["Principled BSDF"])
    e = b.n("ShaderNodeEmission"); e.inputs["Color"].default_value = color
    e.inputs["Strength"].default_value = strength
    b.out(e.outputs[0])
    return m

def void_mat():
    m, b = new_mat("void")
    p = principled(b, (0.0, 0.0, 0.0, 1), 1.0, 0.0, 0.0)
    b.out(p.outputs[0])
    return m

def outline_mat():
    m = glow_mat("outline", C["outline"], 1.0) if LIGHT else None
    if m: m.use_backface_culling = True
    return m

M = dict(
    suit=cloth_mat("suit", C["suit"]),
    cloth=cloth_mat("cloth", C["cloth"]),
    cloak=cloth_mat("cloak", C["cloth"], (0.04, 0.16, 12.0)),
    coat=cloth_mat("coat", C["cloth"], (0.05, 0.18, 12.0)),
    cape=cloth_mat("cape", C["cloth"], (0.1, 0.3)),
    cape2=cloth_mat("cape2", C["cloth"], (0.12, 0.38, 7.0)),
    scarf=cloth_mat("scarf", C["cloth2"], (0.05, 0.25, 14.0)),
    scarfring=cloth_mat("scarfring", C["cloth2"]),
    leather=leather_mat("leather", C["leather"]),
    metal=metal_mat("metal", C["metal"], C["glow"], 0.0),
    trim=metal_mat("trim", C["trim"]),
    blade=metal_mat("blade", C["metal"] if not LIGHT else hx("#F3E6EC")),
    void=void_mat(),
    eye=glow_mat("eye", C["glow"], 4.0),
    rune=glow_mat("rune", C["glow"], 2.2),
    hot=glow_mat("hot", C["glow2"], 2.4),
    outline=outline_mat(),
)

# ---- mesh helpers ---------------------------------------------------------
pivot = bpy.data.objects.new("Pivot", None); col.objects.link(pivot)  # turntable
lift = bpy.data.objects.new("Lift", None); col.objects.link(lift); lift.parent = pivot  # hover offset

def tag(o, tier=0, until=99, outline=True):
    o["tier"], o["until"] = tier, until
    if o.parent is None: o.parent = lift
    if LIGHT and outline and o.type == "MESH":  # sakura: dark rose toon outline (inverted hull)
        o.data.materials.append(M["outline"])
        ol = o.modifiers.new("outline", "SOLIDIFY"); ol.thickness = -0.007; ol.offset = 1.0
        ol.use_flip_normals = True; ol.material_offset = len(o.data.materials) - 1; ol.use_rim = False
    return o

def obj_from_bm(name, bm, material, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p_ in me.polygons: p_.use_smooth = smooth
    if material: me.materials.append(material)
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    return o

def bake(o):
    """Apply all modifiers (evaluated mesh becomes the object's mesh)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = o.data; o.modifiers.clear(); o.data = me
    bpy.data.meshes.remove(old)
    return o

def skin_obj(name, pts, edges, radii, material, subdiv=2, root=0):
    me = bpy.data.meshes.new(name); me.from_pydata([Vector(p_) for p_ in pts], edges, [])
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    sk = o.modifiers.new("skin", "SKIN"); sk.use_smooth_shade = True; sk.branch_smoothing = 0.6
    for i, r in enumerate(radii):
        sv = me.skin_vertices[0].data[i]
        sv.radius = r if isinstance(r, tuple) else (r, r)
        sv.use_root = i == root
    ss = o.modifiers.new("sub", "SUBSURF"); ss.levels = ss.render_levels = subdiv
    bake(o)
    if material: o.data.materials.clear(); o.data.materials.append(material)
    for p_ in o.data.polygons: p_.use_smooth = True
    return o

def seg_t(p_, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p_ - a).dot(ab) / ab.length_squared))
    return t, (p_ - (a + ab * t)).length

def shell(name, src, pred, push, thick, material, tier, until=99, bevel=0.003, solid=True):
    """Armour grown off the body: keep faces whose verts pass pred(co), push them out along normals, solidify, bevel."""
    bm = bmesh.new(); bm.from_mesh(src.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(pred(v.co) for v in f.verts)], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * push
    o = obj_from_bm(name, bm, material)
    if solid:
        so = o.modifiers.new("sol", "SOLIDIFY"); so.thickness = thick; so.offset = 1.0
        bv = o.modifiers.new("bev", "BEVEL"); bv.width = bevel; bv.segments = 2; bv.limit_method = "ANGLE"
    return tag(o, tier, until)

def box(bm, center, size, rot=Matrix.Identity(3)):
    m = Matrix.Translation(center) @ rot.to_4x4() @ Matrix.Diagonal((size[0], size[1], size[2], 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)

def ring_bm(bm, R, r, center, scale=(1, 1, 1), seg=40, rs=8):
    loops = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        loops.append([bm.verts.new(Vector(center) + Vector(((R + r * math.cos(b)) * math.cos(a) * scale[0],
                                                            (R + r * math.cos(b)) * math.sin(a) * scale[1],
                                                            r * math.sin(b) * scale[2])))
                      for b in (2 * math.pi * j / rs for j in range(rs))])
    for i in range(seg):
        for j in range(rs):
            l1, l2 = loops[i], loops[(i + 1) % seg]
            bm.faces.new((l1[j], l2[j], l2[(j + 1) % rs], l1[(j + 1) % rs]))

# ---- skeleton (adult, ~8 heads, contrapposto: weight on his right leg, which is world -X) ----
J = dict(
    pelvis=(0.0, 0.0, 1.00), waist=(0.0, 0.006, 1.15), belly=(0.0, 0.004, 1.29), chest=(0.0, -0.004, 1.42),
    neck0=(0.0, 0.012, 1.555), neck1=(0.0, 0.004, 1.635), head0=(0.0, -0.004, 1.72), head1=(0.0, 0.002, 1.815),
    shR=(-0.232, 0.012, 1.505), elR=(-0.335, 0.035, 1.25), wrR=(-0.405, -0.03, 1.03), haR=(-0.425, -0.055, 0.955),
    shL=(0.232, 0.012, 1.53), elL=(0.305, 0.03, 1.265), wrL=(0.275, -0.15, 1.085), haL=(0.255, -0.215, 1.05),
    hipR=(-0.095, 0.0, 0.985), knR=(-0.125, -0.012, 0.53), anR=(-0.15, 0.02, 0.09), toR=(-0.165, -0.115, 0.03),
    hipL=(0.095, 0.0, 0.965), knL=(0.175, -0.07, 0.525), anL=(0.235, -0.02, 0.09), toL=(0.27, -0.13, 0.03),
    thR=(-0.11, -0.01, 0.76), thL=(0.135, -0.04, 0.75), caR=(-0.14, 0.012, 0.34), caL=(0.205, -0.04, 0.33),
    uaR=(-0.285, 0.025, 1.38), uaL=(0.275, 0.025, 1.40), faR=(-0.37, 0.005, 1.14), faL=(0.295, -0.06, 1.17),
)
V = {k: Vector(v) for k, v in J.items()}
names = list(J)
idx = {k: i for i, k in enumerate(names)}
bones = [("pelvis", "waist"), ("waist", "belly"), ("belly", "chest"), ("chest", "neck0"), ("neck0", "neck1"),
         ("neck1", "head0"), ("head0", "head1"),
         ("chest", "shR"), ("shR", "uaR"), ("uaR", "elR"), ("elR", "faR"), ("faR", "wrR"), ("wrR", "haR"),
         ("chest", "shL"), ("shL", "uaL"), ("uaL", "elL"), ("elL", "faL"), ("faL", "wrL"), ("wrL", "haL"),
         ("pelvis", "hipR"), ("hipR", "thR"), ("thR", "knR"), ("knR", "caR"), ("caR", "anR"), ("anR", "toR"),
         ("pelvis", "hipL"), ("hipL", "thL"), ("thL", "knL"), ("knL", "caL"), ("caL", "anL"), ("anL", "toL")]
R = dict(pelvis=(0.155, 0.11), waist=(0.135, 0.095), belly=(0.15, 0.105), chest=(0.2, 0.13),
         neck0=(0.075, 0.07), neck1=(0.058, 0.058), head0=(0.078, 0.088), head1=(0.075, 0.085),
         shR=0.078, uaR=0.062, elR=0.044, faR=0.046, wrR=0.031, haR=(0.036, 0.022),
         shL=0.078, uaL=0.062, elL=0.044, faL=0.046, wrL=0.031, haL=(0.036, 0.022),
         hipR=0.095, thR=0.088, knR=0.058, caR=0.064, anR=0.036, toR=(0.04, 0.03),
         hipL=0.095, thL=0.088, knL=0.058, caL=0.064, anL=0.036, toL=(0.04, 0.03))
body = skin_obj("Body", [J[k] for k in names], [(idx[a], idx[b]) for a, b in bones], [R[k] for k in names], M["suit"])
tag(body, 0)

def near(*segs, r=0.1, lo=0.0, hi=1.0, zmin=-9, zmax=9, ymax=9):
    """pred: within r of any of the named bone segments (param range lo..hi), inside a z / y window."""
    S = [(V[a], V[b]) for a, b in segs]
    def f(co):
        if not (zmin <= co.z <= zmax and co.y <= ymax): return False
        for a, b in S:
            t, d = seg_t(co, a, b)
            if d < r and lo <= t <= hi: return True
        return False
    return f
def bands(pred, z0, step, gap):
    return lambda co: pred(co) and ((co.z - z0) % step) > gap

# ---- head: void face, eyes, hood, helm --------------------------------------
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1.0,
                          matrix=Matrix.Translation((0, -0.004, 1.765)) @ Matrix.Diagonal((0.088, 0.094, 0.112, 1)))
tag(obj_from_bm("Void", bm, M["void"]), 0, outline=False)
for s in (-1, 1):  # slanted, narrow, menacing
    bm = bmesh.new()
    box(bm, Vector((s * 0.034, -0.094, 1.768)), (0.026, 0.006, 0.0075), Matrix.Rotation(s * 0.24, 3, "Y"))
    tag(obj_from_bm(f"Eye{s}", bm, M["eye"], smooth=False), 0, outline=False)["eye"] = 1

def hood_obj(name, grow, tier, until):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=36, v_segments=22, radius=1.0)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (lambda c: c.y < -0.25 and (c.x / 0.6) ** 2 + ((c.z + 0.12) / 0.66) ** 2 < 1)(f.calc_center_median())], context="FACES")
    for v in bm.verts:
        c = v.co
        if c.z > 0.55: c.y += 0.55 * (c.z - 0.55); c.z += 0.35 * (c.z - 0.55)  # peak swept back
        if c.y < -0.2: c.z += 0.08 * (1 - abs(c.x))  # deep cowl over the brow
        if c.z < -0.4: c.x *= 1.15
        v.co = Vector((c.x * 0.15 * grow, c.y * 0.165 * grow + 0.015, c.z * 0.17 * grow + 1.775))
    # mantle draping onto the shoulders
    bmesh.ops.create_cone(bm, cap_ends=False, segments=36, radius1=0.205 * grow, radius2=0.115 * grow, depth=0.17,
                          matrix=Matrix.Translation((0, 0.02, 1.615)) @ Matrix.Diagonal((1, 0.78, 1, 1)))
    o = obj_from_bm(name, bm, M["cloth"])
    so = o.modifiers.new("sol", "SOLIDIFY"); so.thickness = 0.012
    ss = o.modifiers.new("sub", "SUBSURF"); ss.levels = ss.render_levels = 1
    d = o.modifiers.new("disp", "DISPLACE"); tx = bpy.data.textures.new(name + "tx", "CLOUDS"); tx.noise_scale = 0.08
    d.texture = tx; d.strength = 0.012
    return tag(o, tier, until)
hood_obj("Hood", 1.0, 0, 99)

def helm(tier):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=36, v_segments=22, radius=1.0)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        if c.y < -0.35 and abs(c.x) < 0.6 and -0.2 < c.z < 0.06: kill.append(f)  # eye slit
        elif c.y < -0.6 and abs(c.x) < 0.13 and -0.75 < c.z <= -0.2: kill.append(f)  # breathing slot
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    for v in bm.verts:
        c = v.co
        if c.y < -0.45: c.y = -0.45 + (c.y + 0.45) * 0.45  # flattened faceplate
        if c.z < -0.45: c.z -= 0.22 * (-0.45 - c.z) / 0.55; c.y -= 0.12 * max(0, -c.y)  # jaw guard
        v.co = Vector((c.x * 0.122, c.y * 0.135 - 0.004, c.z * 0.145 + 1.778))
    o = obj_from_bm("Helm", bm, M["metal"])
    so = o.modifiers.new("sol", "SOLIDIFY"); so.thickness = 0.008
    bv = o.modifiers.new("bev", "BEVEL"); bv.width = 0.002; bv.segments = 2; bv.limit_method = "ANGLE"
    tag(o, tier)
helm(7)

def crown(tier):
    """Tier 10: a circlet of swept-back light blades rising from the helm brow."""
    bm = bmesh.new()
    for k, (ang, h) in enumerate([(-58, 0.07), (-30, 0.11), (0, 0.16), (30, 0.11), (58, 0.07)]):
        a = math.radians(ang - 90)
        base = Vector((0.15 * math.cos(a), 0.17 * math.sin(a) + 0.01, 1.875 + 0.012 * math.cos(math.radians(ang))))
        out = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-math.sin(a), math.cos(a), 0))
        tip = base + Vector((0, 0.07, h)) + out * 0.02
        w = 0.016 if k != 2 else 0.022
        vs = [bm.verts.new(base - side * w), bm.verts.new(base + side * w), bm.verts.new(tip),
              bm.verts.new(base + out * 0.008)]
        bm.faces.new(vs[:3]); bm.faces.new((vs[0], vs[3], vs[2])); bm.faces.new((vs[3], vs[1], vs[2]))
    tag(obj_from_bm("CrownBlades", bm, M["hot"], smooth=False), tier, outline=False)
    bm = bmesh.new(); ring_bm(bm, 0.152, 0.006, (0, 0.012, 1.868), scale=(1.0, 1.12, 1), seg=48, rs=6)
    tag(obj_from_bm("Circlet", bm, M["rune"]), tier, outline=False)
crown(10)

# ---- armour ladder (shells) -----------------------------------------------
shell("Boots", body, near(("anR", "toR"), ("caR", "anR"), ("anL", "toL"), ("caL", "anL"), ("knR", "caR"), ("knL", "caL"), r=0.1, zmax=0.4), 0.01, 0.007, M["leather"], 0)
shell("Gloves", body, near(("wrR", "haR"), ("wrL", "haL"), ("faR", "wrR"), ("faL", "wrL"), r=0.06, zmin=0.0), 0.005, 0.004, M["leather"], 0, 6)
shell("Tunic", body, lambda co: 0.98 <= co.z <= 1.52 and abs(co.x) < 0.215, 0.009, 0.006, M["cloth"], 1, 1)
shell("Belt", body, lambda co: 0.985 <= co.z <= 1.05, 0.016, 0.01, M["leather"], 1)
bm = bmesh.new(); box(bm, Vector((0.0, -0.12, 1.017)), (0.05, 0.016, 0.045)); tag(obj_from_bm("Buckle", bm, M["trim"], False), 1)
shell("Bracers", body, near(("faR", "wrR"), ("elR", "faR"), ("faL", "wrL"), ("elL", "faL"), r=0.08, lo=0.25), 0.008, 0.006, M["leather"], 2, 3)
shell("Vest", body, lambda co: 1.05 <= co.z <= 1.50 and abs(co.x) < 0.2 and not (abs(co.x) < 0.035 and co.y < 0), 0.012, 0.008, M["leather"], 2, 4)
shell("Strap", body, lambda co: abs(co.z - (1.36 - 0.85 * co.x)) < 0.028 and 1.1 < co.z < 1.56, 0.02, 0.008, M["leather"], 2)
shell("Wraps", body, bands(near(("thR", "knR"), ("thL", "knL"), ("hipR", "thR"), ("hipL", "thL"), r=0.1, lo=0.2, hi=0.9), 0.0, 0.07, 0.025), 0.007, 0.005, M["leather"], 2, 6)
# tier 4: light plate
for s, k in ((-1, "R"), (1, "L")):
    shp = V["sh" + k]
    shell(f"Pauldron{k}", body, bands(lambda co, shp=shp: (co - shp).length < 0.145 and co.z > shp.z - 0.08, 1.3, 0.045, 0.006), 0.036, 0.011, M["metal"], 4)
shell("Vambrace", body, near(("faR", "wrR"), ("elR", "faR"), ("faL", "wrL"), ("elL", "faL"), r=0.08, lo=0.2), 0.013, 0.008, M["metal"], 4)
shell("Greaves", body, near(("knR", "caR"), ("caR", "anR"), ("knL", "caL"), ("caL", "anL"), r=0.085, lo=0.05, hi=0.9, zmin=0.12), 0.013, 0.008, M["metal"], 4)
# tier 5: heavier armour
shell("Breastplate", body, lambda co: 1.12 <= co.z <= 1.53 and abs(co.x) < 0.205, 0.028, 0.01, M["metal"], 5)
shell("Gorget", body, lambda co: 1.5 <= co.z <= 1.62 and (co - V["neck0"]).length < 0.13, 0.03, 0.008, M["metal"], 5)
shell("Tassets", body, bands(lambda co: 0.8 <= co.z <= 1.0 and co.y < 0.05 and abs(co.x) > 0.02, 0.8, 0.06, 0.008), 0.038, 0.008, M["metal"], 5)
for s, k in ((-1, "R"), (1, "L")):
    shp = V["sh" + k]
    shell(f"PauldronTop{k}", body, lambda co, shp=shp: (co - shp).length < 0.115 and co.z > shp.z - 0.03, 0.068, 0.013, M["trim"], 5)
    shell(f"Knee{k}", body, lambda co, kn=V["kn" + k]: (co - kn).length < 0.075 and co.y < kn.y + 0.01, 0.03, 0.008, M["trim"], 5)
# tier 7: full plate
shell("Cuisses", body, bands(near(("thR", "knR"), ("thL", "knL"), ("hipR", "thR"), ("hipL", "thL"), r=0.1, lo=0.15, hi=0.95), 0.0, 0.08, 0.01), 0.018, 0.008, M["metal"], 7)
shell("Rerebrace", body, near(("uaR", "elR"), ("uaL", "elL"), r=0.075, lo=0.0, hi=0.85), 0.014, 0.007, M["metal"], 7)
shell("Gauntlets", body, near(("wrR", "haR"), ("wrL", "haL"), r=0.06, lo=0.0), 0.009, 0.006, M["metal"], 7)
shell("Faulds", body, bands(lambda co: 0.86 <= co.z <= 1.03 and co.y > 0.0, 0.86, 0.05, 0.008), 0.034, 0.008, M["metal"], 7)

# ---- weapons --------------------------------------------------------------
def sword(name, hand, tip, w, t, guard_w, grip_l, tier, until=99, runes=False, curve=0.0):
    d = (Vector(tip) - Vector(hand)).normalized()
    n = Vector((0, -1, 0)); n = (n - d * n.dot(d)).normalized()  # flat faces the camera at frame 0
    sx = d.cross(n).normalized()
    base = Vector(hand) + d * 0.055
    L = (Vector(tip) - base).length
    bm = bmesh.new(); secs = []
    K = 14
    for i in range(K + 1):
        k = i / K
        wk = w * (1 - 0.18 * k) * (1.0 if k < 0.82 else max(0.0, (1 - k) / 0.18) ** 0.8)
        c = base + d * (L * k) + sx * (curve * math.sin(math.pi * k * 0.9))
        if i == K: secs.append([bm.verts.new(c)] * 4); continue
        secs.append([bm.verts.new(c + sx * wk / 2), bm.verts.new(c + n * t / 2), bm.verts.new(c - sx * wk / 2), bm.verts.new(c - n * t / 2)])
    for i in range(K):
        a, b2 = secs[i], secs[i + 1]
        for j in range(4):
            q = [a[j], a[(j + 1) % 4], b2[(j + 1) % 4], b2[j]]
            uq = list(dict.fromkeys(q))
            if len(uq) >= 3: bm.faces.new(uq)
    bm.faces.new(secs[0][::-1])
    tag(obj_from_bm(name, bm, M["blade"], smooth=False), tier, until)
    bm = bmesh.new()
    rot = Matrix((sx, n, d)).transposed()
    box(bm, base, (guard_w, 0.032, 0.028), rot)                       # cross guard
    box(bm, base - d * (grip_l + 0.02), (0.045, 0.045, 0.045), rot)  # pommel block
    tag(obj_from_bm(name + "Guard", bm, M["trim"], smooth=False), tier, until)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.017, radius2=0.015, depth=grip_l,
                          matrix=Matrix.Translation(base - d * (grip_l / 2 + 0.014)) @ rot.to_4x4())
    tag(obj_from_bm(name + "Grip", bm, M["leather"]), tier, until)
    if runes:  # broken rune line down the fuller, both faces
        bm = bmesh.new()
        for i in range(9):
            k0, k1 = 0.06 + i * 0.085, 0.06 + i * 0.085 + (0.05 if i % 3 else 0.03)
            for sgn in (1, -1):
                c = base + d * (L * (k0 + k1) / 2) + n * sgn * (t / 2 + 0.0012)
                box(bm, c, (0.009, 0.002, L * (k1 - k0)), rot)
        tag(obj_from_bm(name + "Runes", bm, M["rune"], smooth=False), tier, until, outline=False)

sword("Dagger", V["haR"], (-0.54, -0.24, 0.66), 0.038, 0.008, 0.09, 0.1, 1, 2)
sword("BladeR", V["haR"], (-0.63, -0.28, 0.52), 0.045, 0.009, 0.12, 0.11, 3, 5, runes=True, curve=0.02)
sword("BladeL", V["haL"], (0.47, -0.52, 0.66), 0.042, 0.009, 0.11, 0.11, 3, 5, runes=True, curve=-0.02)
sword("Greatsword", V["haR"], (-0.8, -0.2, 0.03), 0.078, 0.013, 0.3, 0.25, 6, runes=True)

# tier 0: the novice's faint shadow orb, above the open left palm
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.055, matrix=Matrix.Translation(V["haL"] + Vector((0, -0.06, 0.07))))
orb, b = new_mat("orb")
fr = b.n("ShaderNodeLayerWeight"); fr.inputs["Blend"].default_value = 0.3
e = b.n("ShaderNodeEmission"); e.inputs["Color"].default_value = C["glow"]
b.link(b.math("MULTIPLY", b.math("POWER", fr.outputs["Facing"], 2.0), 5.0), e.inputs["Strength"])
b.out(e.outputs[0])
tag(obj_from_bm("Orb", bm, orb), 0, 0, outline=False)

# ---- cloth: cloak, capes, scarf (simulated against the body, then baked) ----
coll_body = bpy.data.collections.new("ColBody"); coll_arm = bpy.data.collections.new("ColArmour")
scene.collection.children.link(coll_body); scene.collection.children.link(coll_arm)
def collider(o, colls):
    c = o.modifiers.new("col", "COLLISION"); o.collision.thickness_outer = 0.012; o.collision.cloth_friction = 5
    for cl in colls: cl.objects.link(o)
collider(body, (coll_body, coll_arm))
for nm in ("PauldronR", "PauldronL", "PauldronTopR", "PauldronTopL", "Breastplate", "Gorget", "Tassets", "Faulds"):
    collider(bpy.data.objects[nm], (coll_arm,))

def grid(name, rows, cols, place, material):
    """place(u, v) -> point; v = 0 at the hem, 1 at the pinned top. UV = (u, v)."""
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    grid_v = [[bm.verts.new(place(i / cols, j / rows)) for i in range(cols + 1)] for j in range(rows + 1)]
    for j in range(rows):
        for i in range(cols):
            f = bm.faces.new((grid_v[j][i], grid_v[j][i + 1], grid_v[j + 1][i + 1], grid_v[j + 1][i]))
            for lp, (a, b2) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uv].uv = (a / cols, b2 / rows)
    o = obj_from_bm(name, bm, material)
    vg = o.vertex_groups.new(name="pin")
    vg.add([k for k, vv in enumerate(o.data.vertices) if vv.co.z >= max(v.co.z for v in o.data.vertices) - 0.004 and (k // (cols + 1)) == rows], 1.0, "REPLACE")
    return o

def wrap(name, rows, cols, z0, z1, r0, r1, gap, material, ry=0.78):
    """Open tube around the body (front gap), pinned at the top ring."""
    def place(u, v):
        a = -math.pi / 2 + gap + u * (2 * math.pi - 2 * gap)
        z = z0 + (z1 - z0) * v
        r = r0 + (r1 - r0) * (1 - v)
        return Vector((r * math.cos(a), r * math.sin(a) * ry + 0.02, z))
    return grid(name, rows, cols, place, material)

def sheet(name, rows, cols, top_w, bot_w, top_z, length, y, material, ytop=None):
    def place(u, v):
        w = bot_w + (top_w - bot_w) * v
        yy = y if ytop is None else ytop + (y - ytop) * (1 - v)
        return Vector(((u - 0.5) * w, yy + 0.02 * math.sin(u * math.pi) * (1 - v), top_z - length * (1 - v)))
    return grid(name, rows, cols, place, material)

def clothify(o, coll, wind, mass=0.3, bend=0.6, quality=7):
    cm = o.modifiers.new("cloth", "CLOTH"); s = cm.settings
    s.quality = quality; s.mass = mass; s.air_damping = 1.0
    s.tension_stiffness = s.compression_stiffness = 15; s.shear_stiffness = 5; s.bending_stiffness = bend
    s.vertex_group_mass = "pin"; s.effector_weights.wind = wind
    cs = cm.collision_settings; cs.collection = coll; cs.distance_min = 0.006; cs.use_self_collision = False
    cm.point_cache.frame_start, cm.point_cache.frame_end = 1, 80
    return o

cloak = wrap("Cloak", 30, 44, 0.22, 1.565, 0.115, 0.42, math.radians(24), M["cloak"])
coat = wrap("Coat", 16, 40, 0.42, 1.05, 0.175, 0.3, math.radians(14), M["coat"], ry=0.72)
cape = sheet("Cape", 32, 22, 0.46, 0.95, 1.5, 1.25, 0.25, M["cape"], ytop=0.2)
cape2 = sheet("CapeBig", 36, 26, 0.6, 1.25, 1.53, 1.5, 0.27, M["cape2"], ytop=0.22)
tails = [sheet(f"ScarfTail{k}", 18, 4, 0.075, 0.06, 1.585, ln, 0.11, M["scarf"]) for k, ln in ((0, 0.62), (1, 0.48))]
tails[0].location.x, tails[1].location.x = -0.035, 0.04
# wind force scales with face area, so per-vertex mass is set per cloth to get a similar response
for o_, c_, w_, m_ in ((cloak, coll_body, 0.25, 0.3), (coat, coll_body, 0.3, 0.3), (cape, coll_arm, 1.0, 0.3),
                       (cape2, coll_arm, 0.45, 0.3), (tails[0], coll_body, 1.2, 0.15), (tails[1], coll_body, 1.1, 0.15)):
    clothify(o_, c_, w_, mass=m_)
bpy.ops.object.effector_add(type="WIND")
wind = bpy.context.object
wind.field.strength = WIND; wind.field.noise = 0.4; wind.field.flow = 0.0
wind.location = (-1.5, -2.0, 1.0)
wind.rotation_euler = Vector((0.55, 1.0, 0.12)).to_track_quat("Z", "Y").to_euler()
scene.frame_start, scene.frame_end = 1, 80
for f in range(1, 81): scene.frame_set(f)
# The sim gives the drape and folds; a deterministic sweep then sets the heroic wind silhouette
# (cloth wind in Blender scales with face area and is hard to art-direct). Sweep grows toward the hem.
SWEEP = {"Cloak": (0.03, 0.1, 0.0), "Coat": (0.02, 0.07, 0.0), "Cape": (0.16, 0.18, 0.03), "CapeBig": (0.2, 0.22, 0.05),
         "ScarfTail0": (0.3, 0.26, 0.2), "ScarfTail1": (0.22, 0.2, 0.14)}
for o_ in (cloak, coat, cape, cape2, *tails):
    bake(o_)
    sx_, sy_, sz_ = SWEEP[o_.name]
    me = o_.data; uvd = me.uv_layers["UVMap"].data
    hv = {}
    for lp in me.loops: hv[lp.vertex_index] = uvd[lp.index].uv[1]
    for v in me.vertices:
        k = (1 - hv.get(v.index, 1.0)) ** 1.6
        v.co += Vector((sx_ * k, sy_ * k, sz_ * k * k))
    so = o_.modifiers.new("sol", "SOLIDIFY"); so.thickness = 0.007
    ss = o_.modifiers.new("sub", "SUBSURF"); ss.levels = ss.render_levels = 1
    o_.modifiers.move(1, 0)
    bake(o_)
    for p_ in o_.data.polygons: p_.use_smooth = True
for c_ in (coll_body, coll_arm):
    for o_ in list(c_.objects): c_.objects.unlink(o_)
for o_ in bpy.data.objects:
    for md in [m_ for m_ in o_.modifiers if m_.type == "COLLISION"]: o_.modifiers.remove(md)
if "--debug" in argv:
    for o_ in (cloak, coat, cape, cape2, *tails):
        vs_ = [v.co for v in o_.data.vertices]
        print("[cloth]", wind.name, wind.field.type, wind.field.strength, tuple(round(x, 2) for x in wind.matrix_world.to_3x3() @ Vector((0, 0, 1))), o_.name, [round(min(v[i] for v in vs_), 2) for i in range(3)], [round(max(v[i] for v in vs_), 2) for i in range(3)], flush=True)
    if "--cloth-only" in argv: sys.exit(0)
tag(cloak, 0, 0, outline=False); tag(coat, 1, outline=False); tag(cape, 3, 5, outline=False); tag(cape2, 6, outline=False)
for t_ in tails: tag(t_, 1, 6, outline=False)
bm = bmesh.new(); ring_bm(bm, 0.075, 0.03, (0, 0.006, 1.59), scale=(1.15, 1.0, 1.0), seg=32, rs=10)
tag(obj_from_bm("ScarfWrap", bm, M["scarfring"]), 1, 6)

# ---- wings (tier 7 small, 8-9 large, 10 greatest) ---------------------------
def wings(tag_name, scale, tier, until, radiant):
    mem, b = new_mat("membrane_" + tag_name)
    uvs = b.sep(b.coords("UV"))
    o_ = b.coords("Object")
    nz = b.noise(o_, 6.0, 6.0, 0.6)
    p = principled(b, C["cloth"], 0.7, 0.0, 0.3)
    p.inputs["Sheen Weight"].default_value = 0.4
    vor = b.n("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE"); b.link(o_, vor.inputs["Vector"]); vor.inputs["Scale"].default_value = 4.0
    veins = b.math("LESS_THAN", vor.outputs["Distance"], 0.018)
    p.inputs["Emission Color"].default_value = C["glow"] if radiant else C["deep"]
    b.link(b.math("ADD", b.math("MULTIPLY", veins, 0.9 if radiant else 0.25), b.math("MULTIPLY", b.math("POWER", uvs[0], 3.0), 0.5 if radiant else 0.25)), p.inputs["Emission Strength"])
    bump(b, p, nz, 0.3)
    sh = p.outputs[0]
    # eroded trailing edge + tears
    edge = b.math("ADD", uvs[0], b.math("MULTIPLY", b.math("SUBTRACT", nz, 0.5), 0.5))
    keep = b.math("LESS_THAN", edge, 0.86)
    tears = b.math("LESS_THAN", b.math("MULTIPLY", b.noise(o_, 14.0, 3.0), b.math("ADD", uvs[0], 0.2)), 0.62)
    keep = b.math("MINIMUM", keep, tears)
    tr = b.n("ShaderNodeBsdfTransparent"); mx = b.n("ShaderNodeMixShader")
    b.link(keep, mx.inputs[0]); b.link(tr.outputs[0], mx.inputs[1]); b.link(sh, mx.inputs[2])
    b.out(mx.outputs[0])
    for s in (-1, 1):
        def Pt(x, y, z): return Vector((s * x * scale, 0.1 + (y - 0.1) * scale, 1.4 + (z - 1.4) * scale))
        root, jnt, wr = Pt(0.1, 0.13, 1.42), Pt(0.32, 0.42, 1.72), Pt(0.6, 0.62, 1.86)
        tips = [Pt(0.9, 0.78, 1.74), Pt(0.98, 0.86, 1.42), Pt(0.93, 0.9, 1.1), Pt(0.78, 0.86, 0.82), Pt(0.58, 0.74, 0.6), Pt(0.36, 0.52, 0.66)]
        # spars
        pts = [root, jnt, wr] + tips
        edges = [(0, 1), (1, 2)] + [(2, 3 + i) for i in range(len(tips))]
        rad = [0.026 * scale, 0.024 * scale, 0.02 * scale] + [0.006 * scale] * len(tips)
        sp = skin_obj(f"Spars{tag_name}{s}", pts, edges, rad, M["metal"] if radiant else M["leather"], subdiv=1)
        tag(sp, tier, until)
        # membrane panels: fan from the wrist between consecutive fingers, plus the inner panel to the back
        bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
        panels = [(wr, jnt, tips[0])] + [(wr, tips[i], tips[i + 1]) for i in range(len(tips) - 1)] + [(wr, tips[-1], root), (wr, root, jnt)]
        n_, m_ = 8, 10
        for A, B, Cc in panels:
            grid_v = []
            nrm = (B - A).cross(Cc - A).normalized()
            if nrm.y < 0: nrm = -nrm
            for i in range(n_ + 1):
                row = []
                for j in range(m_ + 1):
                    u, v = i / n_, j / m_
                    sag = 1 - 0.34 * math.sin(math.pi * v) ** 0.8 * u ** 2  # scalloped trailing edge
                    pt = A + (B.lerp(Cc, v) - A) * (u * sag) + nrm * (0.05 * scale * math.sin(math.pi * v) * math.sin(math.pi * u))
                    row.append((bm.verts.new(pt), (u, v)))
                grid_v.append(row)
            for i in range(n_):
                for j in range(m_):
                    q = (grid_v[i][j], grid_v[i + 1][j], grid_v[i + 1][j + 1], grid_v[i][j + 1])
                    try: f = bm.faces.new([x[0] for x in q])
                    except ValueError: continue
                    for lp, x in zip(f.loops, q): lp[uvl].uv = x[1]
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        mo = obj_from_bm(f"Membrane{tag_name}{s}", bm, mem)
        so = mo.modifiers.new("sol", "SOLIDIFY"); so.thickness = 0.004
        tag(mo, tier, until, outline=False)
wings("S", 0.55, 7, 7, False)
wings("L", 0.95, 8, 9, False)
wings("X", 1.06, 10, 10, True)

# ---- aura (static, camera-facing, NOT on the turntable) ----------------------
aura_root = bpy.data.objects.new("Aura", None); col.objects.link(aura_root)

def aura_tag(o, tier, until=99):
    o["tier"], o["until"] = tier, until
    o.parent = aura_root; o.visible_shadow = False
    return o

def plane(name, cx, cz, w, h, y, material):
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    vs = [bm.verts.new((cx + dx * w / 2, y, cz + dz * h / 2)) for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    for lp, c_ in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uv].uv = c_
    return obj_from_bm(name, bm, material, False)

def fog_mat(name, dark, edge, strength, density, seed, kind="smoke"):
    """Noise-driven smoke / flame sheet. UV.y = 0 at the bottom. 'density' is a value node per tier."""
    m, b = new_mat(name, "BLENDED"); m.use_backface_culling = False
    b.N.remove(b.N["Principled BSDF"])
    uv = b.sep(b.coords("UV"))
    x = b.math("SUBTRACT", uv[0], 0.5)
    if kind == "flame":
        mp = b.n("ShaderNodeMapping"); b.link(b.coords("UV"), mp.inputs["Vector"]); mp.inputs["Scale"].default_value = (7.0, 1.6, 1.0)
        nz = b.noise(mp.outputs[0], 2.2, 5.0, 0.62, w=seed)
        shape = b.ramp(b.math("ADD", nz, b.math("MULTIPLY", uv[1], -0.55)), [(0.18, 0.0), (0.42, 1.0)])
    else:
        mp = b.n("ShaderNodeMapping"); b.link(b.coords("UV"), mp.inputs["Vector"]); mp.inputs["Scale"].default_value = (2.2, 1.1, 1.0)
        nz = b.noise(mp.outputs[0], 2.6, 7.0, 0.62, w=seed)
        shape = b.ramp(nz, [(0.42, 0.0), (0.72, 1.0)])
    radial = b.math("SUBTRACT", 1.0, b.math("POWER", b.math("MULTIPLY", b.math("ABSOLUTE", x), 2.0), 2.2), clamp=True)
    vert = b.math("MULTIPLY", b.math("MINIMUM", b.math("MULTIPLY", uv[1], 6.0), 1.0),
                  b.math("POWER", b.math("SUBTRACT", 1.0, uv[1], clamp=True), 1.3))
    a = b.math("MULTIPLY", b.math("MULTIPLY", shape, b.math("MULTIPLY", radial, vert)), b.value("density", density), clamp=True)
    colr = b.n("ShaderNodeMixRGB"); b.put(colr.inputs[0], nz); colr.inputs[1].default_value = dark; colr.inputs[2].default_value = edge
    em = b.n("ShaderNodeEmission"); b.link(colr.outputs[0], em.inputs["Color"])
    b.link(b.math("MULTIPLY", b.math("POWER", nz, 2.0), strength * 2.2), em.inputs["Strength"])
    tr = b.n("ShaderNodeBsdfTransparent"); mx = b.n("ShaderNodeMixShader")
    b.link(a, mx.inputs[0]); b.link(tr.outputs[0], mx.inputs[1]); b.link(em.outputs[0], mx.inputs[2])
    b.out(mx.outputs[0])
    return m

def radial_mat(name, color, strength, alpha, power=2.2):
    m, b = new_mat(name, "BLENDED")
    b.N.remove(b.N["Principled BSDF"])
    uv = b.sep(b.coords("UV"))
    d = b.math("SQRT", b.math("ADD", b.math("POWER", b.math("MULTIPLY", b.math("SUBTRACT", uv[0], 0.5), 2.0), 2.0),
                                  b.math("POWER", b.math("MULTIPLY", b.math("SUBTRACT", uv[1], 0.5), 2.0), 2.0)))
    a = b.math("MULTIPLY", b.math("POWER", b.math("SUBTRACT", 1.0, d, clamp=True), power), b.value("density", alpha), clamp=True)
    em = b.n("ShaderNodeEmission"); em.inputs["Color"].default_value = color; em.inputs["Strength"].default_value = strength
    tr = b.n("ShaderNodeBsdfTransparent"); mx = b.n("ShaderNodeMixShader")
    b.link(a, mx.inputs[0]); b.link(tr.outputs[0], mx.inputs[1]); b.link(em.outputs[0], mx.inputs[2])
    b.out(mx.outputs[0])
    return m

AURA = []  # (object, tier -> density)
kind = P["aura"]
if not LIGHT:
    # back glow
    g = aura_tag(plane("Glow", 0, 1.05, 2.4, 2.6, 0.9, radial_mat("glow_bg", C["deep"], 1.0, 0.0, 2.0)), 0)
    AURA.append((g, lambda t: [0.12, 0.16, 0.2, 0.24, 0.28, 0.34, 0.4, 0.46, 0.52, 0.6, 0.72][t]))
    # rising smoke / tendrils behind
    for k in range(4):
        sm = fog_mat(f"smoke{k}", C["smoke"], C["deep"], 0.35 + 0.1 * k, 0.0, 1.7 * k + 0.3)
        o = aura_tag(plane(f"Smoke{k}", (k - 1.5) * 0.18, 1.0 + 0.1 * k, 1.5 + 0.15 * k, 2.4, 0.45 + 0.12 * k, sm), 0)
        AURA.append((o, lambda t, k=k: max(0.0, min(1.0, (t + 1 - k * 1.5) / 6.0)) * (1.15 if kind == "smoke" else 0.75)))
    # flames hugging the silhouette (tier 3 dark flames at the feet, tier 5+ coloured flame aura)
    for k in range(3):
        fl = fog_mat(f"flame{k}", C["deep"], C["glow"], 1.2, 0.0, 4.1 + k, kind="flame")
        o = aura_tag(plane(f"Flame{k}", (k - 1) * 0.1, 1.0, 1.25 + 0.1 * k, 2.3, 0.32 + 0.06 * k, fl), 5)
        AURA.append((o, lambda t, k=k: 0.0 if t < 5 else min(1.0, 0.35 + 0.13 * (t - 5) - 0.1 * k)))
    df = fog_mat("darkflame", C["smoke"], C["deep"], 0.4, 0.0, 9.3, kind="flame")
    o = aura_tag(plane("DarkFlame", 0, 0.38, 1.3, 0.85, 0.28, df), 2)
    AURA.append((o, lambda t: [0, 0, 0.6, 0.9, 0.9, 0.8, 0.8, 0.8, 0.8, 0.7, 0.7][t]))
    ff = fog_mat("footsmoke", C["smoke"], C["deep"], 0.5, 0.0, 12.1)
    o = aura_tag(plane("FootSmoke", 0, 0.2, 1.4, 0.55, -0.32, ff), 2)
    AURA.append((o, lambda t: [0, 0, 0.55, 0.65, 0.65, 0.7, 0.7, 0.75, 0.75, 0.5, 0.6][t]))
else:
    g = aura_tag(plane("Glow", 0, 1.05, 2.2, 2.4, 0.9, radial_mat("glow_bg", C["trim"], 1.0, 0.0, 2.5)), 0)
    AURA.append((g, lambda t: 0.15 + 0.05 * t))
if kind == "abyss":  # a pit of darkness under the feet with a faint teal lip
    pit = aura_tag(plane("Pit", 0, -0.05, 1.9, 0.9, 0.35, radial_mat("pit", (0, 0.002, 0.004, 1), 0.0, 0.0, 1.2)), 0)
    AURA.append((pit, lambda t: 0.8 + 0.02 * t))
    lip = aura_tag(plane("PitLip", 0, 0.0, 1.5, 0.12, 0.3, radial_mat("lip", C["deep"], 2.0, 0.0, 1.5)), 0)
    AURA.append((lip, lambda t: 0.3 + 0.05 * t))

# particles: theme motif, count grows with tier (index k shows from tier PT[k])
def particles():
    bm_by = {}
    out = []
    for k in range(96):
        tier = min(10, k // 9)
        a = rng.uniform(0, 2 * math.pi)
        rad = rng.uniform(0.32, 0.85)
        z = rng.uniform(0.0, 2.2) if kind != "abyss" else rng.uniform(-0.1, 2.0) ** 1.0
        x, y = rad * math.cos(a), rad * math.sin(a) * 0.6
        if y < 0 and abs(x) < 0.3 and 0.2 < z < 1.9: x = math.copysign(0.3 + abs(x), x)  # keep the body clear
        out.append((tier, Vector((x, y, z)), rng.random(), rng.uniform(0, 6.28)))
    return out
pmats = dict(
    a=glow_mat("p_a", C["glow"], 2.2), b=glow_mat("p_b", C["glow2"], 1.1), c=glow_mat("p_c", C["deep"], 1.6),
)
if kind == "petal":
    pmats["a"] = cloth_mat("petal", hx("#F9C9D8")); pmats["b"] = cloth_mat("petal2", hx("#F29BB7")); pmats["c"] = glow_mat("petal3", C["glow"], 0.8)
if kind == "leaf":
    pmats["a"] = leather_mat("leaf", hx("#2E9B66")); pmats["c"] = leather_mat("leaf2", hx("#1C6B45"))
for k, (tier, pos, r_, rot) in enumerate(particles()):
    bm = bmesh.new()
    m_ = pmats["a"] if k % 3 == 0 else pmats["b"] if k % 3 == 1 else pmats["c"]
    rotm = Matrix.Rotation(rot, 3, "Z") @ Matrix.Rotation(r_ * 2, 3, "X")
    if kind == "petal":
        sz = 0.025 + 0.02 * r_
        vs = [bm.verts.new(pos + rotm @ Vector(v)) for v in ((0, 0, 0), (sz * 0.5, 0, sz * 0.6), (sz * 0.15, 0, sz * 1.0),
                                                            (0, 0, sz * 0.85), (-sz * 0.15, 0, sz * 1.0), (-sz * 0.5, 0, sz * 0.6))]
        bm.faces.new(vs)
    elif kind == "leaf":
        sz = 0.03 + 0.03 * r_
        if k % 3 == 1:
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.008, matrix=Matrix.Translation(pos))
        else:
            vs = [bm.verts.new(pos + rotm @ Vector((sz * math.sin(math.pi * i / 6) ** 0.8 * (0.4 if i else 0), 0, sz * i / 6 - sz / 2))) for i in range(7)]
            vs2 = [bm.verts.new(pos + rotm @ Vector((-sz * math.sin(math.pi * i / 6) ** 0.8 * 0.4, 0, sz * i / 6 - sz / 2))) for i in range(1, 6)]
            bm.faces.new(vs + vs2[::-1])
    elif kind == "spark":
        box(bm, pos, (0.006, 0.006, 0.02 + 0.05 * r_), Matrix.Rotation((r_ - 0.5) * 0.5, 3, "Y"))
    elif kind == "abyss":
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.006 + 0.01 * r_, matrix=Matrix.Translation(pos))
    else:  # darkness: voxel-ish embers
        s_ = 0.008 + 0.016 * r_ ** 2
        box(bm, pos, (s_, s_, s_), rotm)
    o = obj_from_bm(f"P{k}", bm, m_, False)
    aura_tag(o, tier)

if kind == "abyss":  # dark void tendrils rising from the pit around the legs
    tm, b = new_mat("tendril")
    fr = b.n("ShaderNodeLayerWeight"); fr.inputs["Blend"].default_value = 0.4
    p = principled(b, (0.0, 0.004, 0.006, 1), 0.4, 0.0, 0.5)
    p.inputs["Emission Color"].default_value = C["glow"]
    b.link(b.math("MULTIPLY", b.math("POWER", fr.outputs["Facing"], 4.0), 0.8), p.inputs["Emission Strength"])
    b.out(p.outputs[0])
    for k in range(10):
        a0 = rng.uniform(0.12 * math.pi, 0.88 * math.pi) * (1 if k % 4 else -0.15); r0 = rng.uniform(0.3, 0.55)
        pts = []
        for i in range(7):
            u = i / 6
            a = a0 + u * rng.uniform(1.2, 2.6) * (1 if k % 2 else -1)
            rr_ = r0 * (1 - 0.35 * u) + 0.05 * math.sin(u * 7 + k)
            pts.append((rr_ * math.cos(a), rr_ * 0.7 * math.sin(a) + 0.1, -0.05 + u * (0.5 + 0.09 * k)))
        o = skin_obj(f"Tendril{k}", pts, [(i, i + 1) for i in range(6)], [0.035 * (1 - i / 7) + 0.004 for i in range(7)], tm, subdiv=1)
        o.visible_shadow = False
        aura_tag(o, k)

# ground rune circle (tier 9+)
rc, b = new_mat("runecircle", "BLENDED")
b.N.remove(b.N["Principled BSDF"])
uv = b.sep(b.coords("UV"))
dx, dz = b.math("SUBTRACT", uv[0], 0.5), b.math("SUBTRACT", uv[1], 0.5)
rr = b.math("MULTIPLY", b.math("SQRT", b.math("ADD", b.math("POWER", dx, 2.0), b.math("POWER", dz, 2.0))), 2.0)
ang = b.math("ARCTAN2", dz, dx)
def band(c, w): return b.math("LESS_THAN", b.math("ABSOLUTE", b.math("SUBTRACT", rr, c)), w)
ticks = b.math("MULTIPLY", b.math("GREATER_THAN", b.math("FRACT", b.math("MULTIPLY", ang, 36 / (2 * math.pi))), 0.45),
               b.math("MULTIPLY", b.math("GREATER_THAN", rr, 0.8), b.math("LESS_THAN", rr, 0.9)))
glyph = b.math("MULTIPLY", b.math("GREATER_THAN", b.noise(b.coords("UV"), 40.0, 1.0), 0.55), ticks)
lines = b.math("MAXIMUM", b.math("MAXIMUM", band(0.96, 0.018), band(0.76, 0.012)), b.math("MAXIMUM", glyph, band(0.55, 0.008)))
star = b.math("MULTIPLY", b.math("LESS_THAN", b.math("ABSOLUTE", b.math("SUBTRACT", b.math("FRACT", b.math("MULTIPLY", ang, 6 / (2 * math.pi))), 0.5)), 0.02), b.math("LESS_THAN", rr, 0.76))
lines = b.math("MAXIMUM", lines, star)
fill = b.math("MULTIPLY", b.math("SUBTRACT", 1.0, rr, clamp=True), 0.25)
a_ = b.math("MULTIPLY", b.math("MAXIMUM", lines, fill), b.value("density", 1.0), clamp=True)
em = b.n("ShaderNodeEmission"); em.inputs["Color"].default_value = C["glow"]; em.inputs["Strength"].default_value = 1.4
tr = b.n("ShaderNodeBsdfTransparent"); mx = b.n("ShaderNodeMixShader")
b.link(a_, mx.inputs[0]); b.link(tr.outputs[0], mx.inputs[1]); b.link(em.outputs[0], mx.inputs[2]); b.out(mx.outputs[0])
bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
vs = [bm.verts.new((x * 0.85, y * 0.85, 0.004)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
f = bm.faces.new(vs)
for lp, c_ in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uvl].uv = c_
circle = aura_tag(obj_from_bm("RuneCircle", bm, rc, False), 9)

# ---- camera + lights ------------------------------------------------------
target = Vector((0, 0, 1.12))
pitch = math.radians(7)  # a touch above, looking down: the ground circle reads as an ellipse
cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 85; cam_data.sensor_fit = "VERTICAL"; cam_data.sensor_height = 24
VIEW_H = 2.95
dist = VIEW_H / (2 * math.tan(math.atan(12 / 85)))
cam = bpy.data.objects.new("Cam", cam_data); col.objects.link(cam)
cam.location = target + Vector((0, -dist * math.cos(pitch), dist * math.sin(pitch)))
cam.rotation_euler = (math.pi / 2 - pitch, 0, 0)
scene.camera = cam

def light(name, energy, loc, size, color):
    d = bpy.data.lights.new(name, "AREA"); d.energy = energy; d.size = size; d.color = color[:3]
    o = bpy.data.objects.new(name, d); col.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 1.15)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o
K = 1.6 if LIGHT else 1.0
light("Key", 210 * K, (-2.2, -2.6, 3.2), 2.0, C["key"])
light("Fill", 22 * K, (2.6, -2.4, 1.2), 3.0, C["key"])
light("RimL", 1800 * (0.35 if LIGHT else 1), (-2.0, 2.4, 2.6), 1.0, C["rim1"])
light("RimR", 1600 * (0.35 if LIGHT else 1), (2.1, 2.2, 1.8), 1.0, C["rim2"])
light("Under", 40, (0, -1.5, -0.4), 1.5, C["deep"])

world = bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = C["bg"] if not LIGHT else hx("#FFE8F0")
world.node_tree.nodes["Background"].inputs[1].default_value = 0.5 if LIGHT else 0.25

# ---- render settings ------------------------------------------------------
r = scene.render
r.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 32
r.resolution_x, r.resolution_y, r.resolution_percentage = W, H, 100
r.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
r.image_settings.file_format = "WEBP"
r.image_settings.color_mode = "RGBA"
r.image_settings.quality = 60  # keeps 1320 frames under the 25 MB budget

# Bloom on emissive highlights only (threshold above every lit surface), then alpha = max(alpha, glow luminance)
# so the halo survives on transparent pixels.
tree = bpy.data.node_groups.new("Bloom", "CompositorNodeTree")
tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
scene.compositing_node_group = tree
N, L = tree.nodes, tree.links
rl = N.new("CompositorNodeRLayers")
gl = N.new("CompositorNodeGlare")
gl.inputs["Type"].default_value = "Bloom"
gl.inputs["Quality"].default_value = "High"
gl.inputs["Threshold"].default_value = 1.0
gl.inputs["Strength"].default_value = 0.0 if LIGHT else 0.7
gl.inputs["Size"].default_value = 0.6
sep = N.new("CompositorNodeSeparateColor")
lum = N.new("CompositorNodeRGBToBW")
mxn = N.new("ShaderNodeMath"); mxn.operation = "MAXIMUM"
mnn = N.new("ShaderNodeMath"); mnn.operation = "MINIMUM"; mnn.inputs[1].default_value = 1.0
sa = N.new("CompositorNodeSetAlpha")
out = N.new("NodeGroupOutput")
L.new(rl.outputs["Image"], gl.inputs["Image"])
L.new(rl.outputs["Image"], sep.inputs[0])
L.new(gl.outputs["Glare"], lum.inputs[0])
L.new(sep.outputs["Alpha"], mxn.inputs[0]); L.new(lum.outputs[0], mxn.inputs[1])
L.new(mxn.outputs[0], mnn.inputs[0])
L.new(gl.outputs["Image"], sa.inputs["Image"]); L.new(mnn.outputs[0], sa.inputs["Alpha"])
sa.inputs["Type"].default_value = "Replace Alpha"
L.new(sa.outputs[0], out.inputs[0])

# ---- per-tier state -------------------------------------------------------
RUNE = [0, 0, 0, 0, 0, 0, 1.0, 1.4, 1.7, 2.0, 2.6]
def set_tier(t):
    for o in bpy.data.objects:
        if "tier" in o: o.hide_render = not (o["tier"] <= t <= o["until"])
    lift.location.z = 0.2 if t >= 9 else 0.0
    M["eye"].node_tree.nodes["Emission"].inputs["Strength"].default_value = 1.6 if t == 0 else (4.0 if t < 10 else 6.0)
    nd = M["metal"].node_tree.nodes
    nd["rune"].outputs[0].default_value = RUNE[t]
    nd["lum"].outputs[0].default_value = 0.06 if t >= 10 else 0.0
    for o, fn in AURA:
        o.active_material.node_tree.nodes["density"].outputs[0].default_value = fn(t)
    if not LIGHT: gl.inputs["Strength"].default_value = BLOOM * (0.8 + 0.04 * t)

# ---- render loop ----------------------------------------------------------
t0 = time.time()
for t in TIERS:
    set_tier(t)
    os.makedirs(os.path.join(OUT, THEME, f"t{t}"), exist_ok=True)
    for f in FRAME_LIST:
        pivot.rotation_euler.z = math.radians(15 * f)
        r.filepath = os.path.join(OUT, THEME, f"t{t}", f"{f:02d}.webp")
        bpy.ops.render.render(write_still=True)
    print(f"[forms] {THEME} tier {t} done, {time.time() - t0:.0f}s elapsed", flush=True)
print(f"[forms] RENDER_SECONDS {time.time() - t0:.1f}", flush=True)

# ---- formFrames.ts (lists every theme) ---------------------------------------
if FULL:
    lines_ = ["// Generated by blender/forms.py. Do not edit.",
              "export type ThemeId = " + " | ".join(f"'{t}'" for t in THEMES) + ";",
              "export const THEME_FRAMES: Record<ThemeId, number[][]> = {"]
    for th in THEMES:
        lines_.append(f"  {th}: [")
        for t in range(11):
            reqs = ", ".join(f"require('../../assets/forms/{th}/t{t}/{f:02d}.webp')" for f in range(FRAMES))
            lines_.append(f"    [{reqs}],")
        lines_.append("  ],")
    lines_ += ["};", "export const FORM_FRAMES: number[][] = THEME_FRAMES.darkness;", ""]
    with open(os.path.join(APP, "src", "ui", "formFrames.ts"), "w", newline="\n") as fh:
        fh.write("\n".join(lines_))

# ---- contact sheet ----------------------------------------------------------
if SHEET:
    import numpy as np
    tw, thh = W // 2, H // 2
    root = os.path.join(OUT, THEME)
    tiers = sorted(int(d[1:]) for d in os.listdir(root) if d.startswith("t") and d[1:].isdigit())
    sheet = np.zeros((thh * 2, tw * len(tiers), 4), dtype=np.float32)
    bg = P["bg"].lstrip("#")
    sheet[...] = (*(int(bg[i:i + 2], 16) / 255 for i in (0, 2, 4)), 1)
    for i, t in enumerate(tiers):
        for j, f in enumerate((0, 6)):
            p_ = os.path.join(root, f"t{t}", f"{f:02d}.webp")
            if not os.path.exists(p_): continue
            img = bpy.data.images.load(p_); img.colorspace_settings.name = "Non-Color"
            px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
            bpy.data.images.remove(img)
            px = px.reshape(thh, 2, tw, 2, 4).mean(axis=(1, 3))
            a = px[..., 3:4]
            y0 = (1 - j) * thh  # pixel rows run bottom-up
            tile = sheet[y0:y0 + thh, i * tw:(i + 1) * tw]
            tile[..., :3] = tile[..., :3] * (1 - a) + px[..., :3] * a
    out_img = bpy.data.images.new(f"sheet_{THEME}", sheet.shape[1], sheet.shape[0], alpha=True)
    out_img.colorspace_settings.name = "Non-Color"
    out_img.pixels = sheet.ravel()
    dst = os.path.join(SHEET, f"{THEME}.png")
    out_img.filepath_raw = dst; out_img.file_format = "PNG"; out_img.save()
    bpy.data.images.remove(out_img)
    print(f"[forms] sheet -> {dst}", flush=True)
