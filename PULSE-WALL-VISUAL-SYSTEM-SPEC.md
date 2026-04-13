# Pulse Wall — Visual System Specification
### Version 3 — Full Topology Framing + 3D Evolution Path

**Revision history:**
- V1: Initial decomposition from reference imagery
- V2: White background, gradient clamping codified, arc topology elevated (incorrectly as primary composition mode)
- V3: Corrected framing — arc and fan are emergent visual textures within the holistic enterprise topology, not separate composition modes. Full 12×5 canvas composition defined against actual node/edge data. 3D evolution path added.

---

## FOUNDATIONAL REFRAME

The reference images are not layout templates. They are visual texture samples — what the system looks like when you isolate a segment of it and zoom in. The basketball arc image shows what a ring boundary looks like in close-up. The fan image shows what a high-connectivity hub node looks like in close-up. In production, both textures exist simultaneously and continuously across the full topology, which spans the entire 12×5 tile wall.

**The topology is the canvas.** Arc and fan are behaviors that emerge from the topology's structure, not compositions applied on top of it.

The full visualization is a single continuous field: 47 nodes, ~110 edges, 6 concentric trust rings rendered holistically across a 12-unit × 6-unit coordinate space mapping to 12 tiles wide × 5 tiles tall, approximately 2:1 aspect.

---

## DESIGN PRIORITIES

These three rules govern all rendering decisions. They apply globally across the full canvas — not to individual segments or modes.

**1. Gradient Clamping.** Color occupies a defined parametric window in the middle-to-far section of every strand. Outside that window: neutral. This is the primary brand signature. It applies to every strand on the wall, whether a cross-ring telemetry path or a local service connection.

**2. The Visual Language Is Emergent, Not Applied.** Arc silhouettes and fan branching patterns are not drawn — they appear because of how the topology is structured. Rings produce arcs; hub nodes produce fans. The designer's job is to ensure the strand/node/gradient system is rich enough that these patterns materialize naturally at scale.

**3. The System Is Designed for 3D.** Every 2D spatial decision must have a clear 3D analog. Node positions are ring-based, not screen-position-based. Edges are source-to-target, not drawn paths. The camera is a parameter, not a baked-in perspective. The visual language — gradient clamping, strand behavior, node anatomy — translates directly to 3D without redesign.

---

## 1. Visual DNA Decomposition

### A. Spatial System — Full Topology Canvas

**Canvas specification:**

The visualization occupies the full 12×5 tile wall. The coordinate space is 12 units wide × 6 units tall (rows 0–5), with a slight vertical over-allocation that clips gracefully at the tile boundary. This is the grid defined in `components.json` and used for all node placement.

```
Canvas origin:      top-left (0, 0)
Canvas extent:      (12, 6) coordinate units
Tile mapping:       1 coordinate unit ≈ 1 tile column / 1 tile row
Safe zone:          x: [0.5, 11.5], y: [0.3, 5.7]
Tile seam columns:  x = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
Tile seam rows:     y = 1, 2, 3, 4
```

**Node distribution across canvas (from topology data):**

| Ring | Node Count | Horizontal Span | Density Character |
|---|---|---|---|
| External | 6 | Cols 0, 10–11 | Anchored at extreme edges — the perimeter |
| Enterprise Edge | 9 | Cols 1–4, 8–9 | Inner perimeter, slightly inset |
| Network Enforcement | 14 | Cols 1–9 | Most distributed ring; largest node count |
| Application | 8 | Cols 3–8 | Mid-field, relatively compact |
| SOC Platform | 6 | Cols 4–7 | Central band, telemetry convergence zone |
| Core | 4 | Cols 5–6, Rows 2–3 | True center; tightest cluster |

The topology reads spatially as: sparse at the horizontal extremes (external/perimeter), densifying toward center (application/SOC), then compressing again at the core. The widest visible ring, Network Enforcement, spans nearly the full width and will produce the most visible strand activity during security scenarios.

**Rendering geometry:**

The concentric-trust layout engine places each node within its ring at a position derived from its `col` and `row` values in the component data. A pseudo-3D projection (yaw, pitch, perspective parameters) then transforms these positions for rendering. The default projection (yaw −0.62, pitch 0.30) gives a slight top-down left-viewing angle that stretches the concentric structure horizontally — appropriate for the 2:1 canvas.

At full canvas scale, the topology fills the wall with the core cluster visible as the visual center of gravity. External threat nodes sit at the far left and right edges. The projection is not aggressively 3D — it is closer to an angled plan view than a dramatic perspective. This preserves legibility while establishing depth.

---

### B. Emergent Visual Patterns — Where Arc and Fan Appear

The reference imagery shows two distinct local visual textures. Both are emergent from the topology's structure. Neither requires explicit composition logic — they arise from the strand/node system applied to specific structural conditions.

**Arc silhouette: emerges at ring boundaries.**

When multiple nodes within a single concentric ring have active strands flowing inward or outward, the collective silhouette of those strands forms an arc envelope. The reason: ring nodes are distributed on a roughly elliptical path around the center. Their strands, all converging toward or from the core, fan out at comparable angles. Viewed as a group, the terminal nodes trace an arc, and the strands beneath them trace an arc-bounded field.

This is directly visible in the basketball reference: the vertical lines represent strands flowing from nodes in a single ring layer, and their collective height-envelope forms the smooth arc shape. In the full topology, you will see this at every ring — most prominently at Network Enforcement (14 nodes, widest spread) and SOC Platform (6 nodes, tight central band).

The arc silhouette is sharpest when:
- Strands within a ring are drawn at consistent baseline height from their ring's radial centerline
- Strand height or opacity encodes node activity — active nodes have taller/brighter strands
- The ring's node distribution has visible horizontal spread

**Fan branching: emerges at high-connectivity hub nodes.**

Hub nodes in this topology are identifiable by in-degree + out-degree:

| Node | Ring | Degree | Visual Character |
|---|---|---|---|
| `splunk-es` | SOC Platform | 12+ connections | Central telemetry sink — massive inbound fan from all rings |
| `otel` | Network Enforcement | 8 inbound | OTel collector fan — all app/service nodes streaming in |
| `fw-perimeter` | Network Enforcement | 7 connections | Security enforcement hub — fan in and out |
| `cisco-xdr` | SOC Platform | 6 connections | Detection platform fan |
| `nexus` | Network Enforcement | 4 connections | East-west switching hub |
| `backend` | Application | 7 connections | Application core — heavy east-west fan |

At each of these nodes, the multi-strand Bézier system produces the fan texture naturally. Multiple strands originating at the hub node diverge at slight angles toward their respective target nodes. The bundle spreads as it leaves the hub (controlled by `strand_spread`), then narrows as it approaches each target. Where multiple bundles from the same hub cross or near-intersect, they produce the overlapping branch texture visible in the radial fan reference.

The fan texture is densest in the SOC Platform ring during active scenarios — `splunk-es` receives telemetry from across the entire topology, and its inbound connection density produces a pronounced convergence fan visible even at full canvas scale.

**Simultaneous presence:**

At full canvas scale, arc and fan exist simultaneously and continuously. The network enforcement ring produces visible arc silhouettes along its outer edge while the hub nodes within it (fw-perimeter, umbrella, nexus) generate fan branching toward both inner and outer rings. The SOC Platform ring is the most visually rich area of the canvas — arc silhouette from its ring boundary, massive inbound fan to splunk-es and cisco-xdr, and the densest gradient-clamped color activity during any scenario.

---

### C. Node System

Node anatomy is consistent across the full canvas. Scale relationships change with ring depth — outer ring nodes are rendered slightly larger (they are physically further from the viewer in the 3D model we're heading toward) to compensate for perspective reduction. Inner ring nodes are slightly smaller at baseline but increase more dramatically during event states, making the core light up prominently during escalation.

**Node tiers:**

| Tier | Rings | Base Radius | Ring Stroke | Fill |
|---|---|---|---|---|
| Perimeter | External, Enterprise Edge | 4–5px | 1px | #0D1A2E |
| Enforcement | Network Enforcement | 3.5–4.5px | 1px | #0D1A2E |
| Service | Application, SOC Platform | 3–4px | 1px | #0D1A2E |
| Core | Core Assets | 4–5px (elevated base) | 1.5px | #0D1A2E |

Core nodes carry a permanently elevated base radius because they are always the highest-value targets. Their visual weight at baseline communicates criticality without requiring an event state to activate it.

**Ring stroke color by type** (from `TYPE_COLOR` in generative.js):
```
security:   [12, 128, 255]     — Network Enforcement dominant
platform:   [0, 210, 255]      — SOC Platform
network:    [0, 78, 220]
endpoint:   [0, 100, 220]      (adjusted for white background — see Section E)
data:       [12, 128, 255]     — Core Assets
service:    [12, 128, 255]
server:     [0, 78, 220]
external:   [0, 210, 255]
```

---

### D. Edge / Path System

**Three edge categories exist in this topology:**

**Solid edges** — primary network and service connections. These are the structural flows of the system: traffic moving through firewalls, services calling each other, data moving to storage. Multi-strand Bézier, gradient clamping applied, moderate strand count (1.5–2× per edge).

**Dashed edges** — trust boundaries and controlled handoffs. The AI→backend trust boundary, byod→campus dashed relationship, SOAR→fw-perimeter remediation actions. These render with dashed strand continuity. Gradient clamping still applies to the colored segments within dashes.

**Dotted edges** — telemetry and monitoring flows. The dominant edge type in this topology: OTel collectors receiving from 8 app nodes, splunk-es receiving from 12+ sources, cisco-xdr receiving from endpoint/access tools. These are rendered at lower opacity than solid edges (0.60× the baseline opacity). Their cumulative density across the topology will be very high — they represent the "background hum" of observability.

**Strand counts by edge type:**
```
solid:    1.5–2.5 strands per edge
dashed:   1.0–1.5 strands per edge
dotted:   0.5–1.0 strands per edge (half to single strand)
```

The lower strand count for dotted edges is intentional — these are the most numerous edge type (50+) and without a strand count reduction they would visually overwhelm the topology.

**Cross-ring edge behavior:**

Edges crossing multiple rings follow longer paths with more pronounced arcs. The control-point offset (arc height) scales with distance: `arc_height = min(path_length × 0.22, 64px)`. Long-distance telemetry flows from external nodes to splunk-es will have distinctly arced paths that visually communicate the span of that connection.

**Path direction convention:**

All paths animate in the semantic direction of data flow — from source to target. Telemetry flows from endpoints toward splunk-es. Traffic flows from external through enforcement toward application. Attack propagation flows outward from the external ring inward toward core. This directionality is critical to legibility — the viewer should always be able to read which way information is moving.

---

### E. Color System

**Background field:**
```
background:       #F2F1EC  (warm off-white, slight cream tint)
grain_type:       Perlin / simplex noise
grain_frequency:  1px at render resolution
grain_opacity:    0.06–0.08
grain_seed:       fixed per session
```

**Strand neutral (all strands at baseline — outside gradient window):**
```
strand_neutral_color:    #1B2B4A  (deep navy)
strand_neutral_opacity:
  solid edges:    0.22–0.32
  dashed edges:   0.18–0.25
  dotted edges:   0.10–0.16
```

**Signal palette (applied within the gradient window during event states):**
```
blue:     (0, 78, 220)      network flows
mid_blue: (12, 128, 255)    security / data flows
cyan:     (0, 210, 255)     platform / external
violet:   (124, 126, 255)   anomaly warning
magenta:  (241, 0, 163)     security anomaly / critical
orange:   (255, 116, 56)    operational critical / escalation
```

Tint values from the original palette (172, 218, 255) do not have sufficient contrast against off-white background and are replaced with their full-saturation equivalents as specified in V2.

**Multi-scenario color assignment:**

When multiple kiosk scenarios run concurrently (up to 4), each receives a distinct scenario accent color from `routeColors` in routes.json:
```
Scenario 0:   #22d3ee  (cyan)
Scenario 1:   #a78bfa  (violet)
Scenario 2:   #f472b6  (pink)
Scenario 3:   #fbbf24  (amber)
```
These colors become the `signal_color` value for gradient windows on edges activated by that scenario.

---

### F. Gradient Clamping — PARAMOUNT BRAND RULE

**Unchanged from V2. This is the defining visual signature of the system.**

Color occupies a parametric window in the middle-to-far section of each strand. Outside that window: neutral dark navy. The gradient window is invisible at baseline (signal_color equals neutral_color) and materializes only during active/anomaly/critical states.

```
color_neutral:          t < 0.30              → strand_neutral
color_fade_in:          t = 0.30 → 0.60       → smoothstep(neutral, signal_color)
color_peak:             t = 0.60 → 0.80       → signal_color at full saturation
color_fade_out:         t = 0.80 → 0.92       → smoothstep(signal_color, neutral)
terminal_segment:       t > 0.92              → strand_neutral × 0.7 (darker near node)
```

**Multi-strand stagger:** When a logical edge spawns multiple strands, each strand's gradient window shifts by ±`strand_stagger_amount` (default 0.06) in t, seeded by strand index. The color windows across a bundle are offset, creating a subtle shimmer. The shimmer is most visible in the fan areas — dense bundles at hub nodes will show the gradient windows flickering across the bundle depth as each strand's window arrives at slightly different path positions.

**At full canvas scale:** Most of the canvas is the neutral dark navy strand field — the system at rest reads as technical line drawing on off-white. When a scenario fires, gradient windows materialize on the affected path chain. At full escalation, the affected paths through the topology are lit with color windows floating in their middle sections while the rest of the strand field remains neutral. The contrast between lit and unlit is the primary information carrier at full wall scale.

**GLSL implementation:**
```glsl
vec3 strandColor(float t, vec3 neutralColor, vec3 signalColor) {
  float fadeStart  = 0.30;
  float colorPeak  = 0.60;
  float fadeEnd    = 0.80;
  float neutralEnd = 0.92;

  if (t < fadeStart)  return neutralColor;
  if (t < colorPeak)  return mix(neutralColor, signalColor,
                        smoothstep(fadeStart, colorPeak, t));
  if (t < fadeEnd)    return signalColor;
  if (t < neutralEnd) return mix(signalColor, neutralColor,
                        smoothstep(fadeEnd, neutralEnd, t));
  return neutralColor * 0.7;
}
```

---

### G. Signal Hierarchy

At full canvas scale the hierarchy operates across four distances:

**Wall-scale read (from 6m+):** Only the highest-intensity signals are perceptible — the brightest, most saturated gradient windows on the most-active paths. Node scale changes are invisible. The viewer sees which regions of the topology are active.

**Mid-range read (3–5m):** Ring structure becomes visible. Arc silhouettes at ring boundaries are perceptible. Hub fan patterns are readable. Gradient window positions on individual paths are visible.

**Close read (1–3m):** Individual strand behavior is visible. Multi-strand bundle shimmer is perceptible. Node labels (if enabled) are readable. Annotation callouts are clearly visible.

**Design implication:** The gradient clamping rule must produce sufficient luminance contrast to be readable at wall scale. The clamped color window must be at near-full saturation during active states — not a subtle tint, but a decisive color presence within the neutral field. The neutral strand field must be genuinely neutral (not a subtle color — actual dark navy on off-white, no color contamination).

---

### H. Annotation Layer

Unchanged from V2. Annotations are triggered by node state, positioned avoiding tile seams, and visible at close-to-mid range. At full wall scale (6m+) they function as visual punctuation rather than readable text — their presence indicates where the narrative is concentrated.

---

## 2. System Logic Extraction

The data → visual behavior mapping is unchanged from V2. Applied to the actual topology:

**Normal baseline:** All 110 edges are rendering continuously. Solid edges at 0.22–0.32 opacity neutral strands. Dotted edges at 0.10–0.16. No gradient windows active. The SOC platform ring (splunk-es, cisco-xdr) shows the densest neutral strand field due to its high in-degree. The topology is legible, structured, alive with motion from chase particles.

**Security scenario activation (e.g., React2Shell):** The attack path — internet-users → dmz → fw-perimeter → adc → web → ai → backend → ips → app-server → cisco-xdr → splunk-es — activates sequentially. Gradient windows materialize on each edge in sequence with 300ms cascade delay per hop. This is a left-to-right-to-center narrative across the wall: the fan texture at fw-perimeter lights up, the arc band of the Network Enforcement ring shows the intrusion path, and the telemetry convergence at splunk-es produces a fan burst of arriving color windows.

**Observability scenario activation:** App tier edges (web, api, app, backend, otel) show service degradation through elevated strand opacity and anomaly-state gradient windows in orange. The OTel collector fan (8 inbound connections) is the visual epicenter — all app node strands arriving at otel simultaneously in distress state produces a dramatic convergence.

**Unified mode:** Both security and observability paths are active simultaneously on overlapping subgraphs. The scenario accent color assignment (cyan for scenario 0, violet for scenario 1) keeps the narratives visually separated. Two distinct gradient window color types are visible on the canvas simultaneously — the viewer can track two independent incident investigations by color.

---

## 3. Parametric Model

Parameters inherited from V2. Additions and revisions for full-topology context:

```
// TOPOLOGY PARAMETERS
ring_count:             int    [4, 8]           default: 6
  // Valid values for this project: 6 (matches components.json ring structure)

node_count_total:       int    —                fixed: 47
  // Determined by topology definition. Not a tuning parameter.

edge_count_total:       int    —                fixed: ~110
  // Determined by routes.json + components.json edges.

// DOTTED EDGE DENSITY CONTROL
telemetry_strand_multiplier:  float  [0.3, 1.5]  default: 0.75
  // Multiplied against path_density for dotted edges only.
  // At default 0.75, dotted edges render at 75% of solid edge strand density.
  // Critical parameter: with 50+ dotted edges in this topology, values above 1.0
  // will produce visual congestion that overwhelms solid/dashed edges.
  // Relationship: total dotted strands = edge_count_dotted × path_density × 0.75

// RING VISUAL WEIGHT
ring_weight_curve:      array  [0.6, 0.7, 0.85, 0.90, 1.0, 0.95]
  // Per-ring opacity multiplier applied to all strands in that ring.
  // Index 0 = external (most perimeter), index 5 = core (center).
  // Default curve weights the inner rings more heavily, making the core
  // visually dominant at rest. Adjust to change where the eye rests at baseline.

// HUB NODE STRAND AMPLIFICATION
hub_threshold_degree:   int    [3, 10]          default: 5
  // Nodes with degree above this threshold receive amplified strand counts.
hub_strand_multiplier:  float  [1.0, 3.0]       default: 1.8
  // Multiplier on strand count for hub nodes' outgoing edges.
  // Creates the pronounced fan texture at splunk-es, fw-perimeter, etc.
  // Relationship: interacts with path_density. At path_density=1.0 and
  // hub_strand_multiplier=1.8, fw-perimeter (degree 7) produces ~3.5 strands
  // per outgoing edge — sufficient for visible fan texture.

// GRADIENT CLAMPING (unchanged from V2)
color_fade_in_start:    0.30
color_peak:             0.60
color_fade_out_start:   0.80
color_neutral_end:      0.92
strand_stagger_amount:  0.06

// ARC SILHOUETTE ENHANCEMENT
ring_baseline_elevation:  float  [0.0, 0.3]     default: 0.08
  // Minimum strand height as fraction of ring's vertical span, regardless of
  // activity level. Prevents rings from going fully flat at baseline.
  // A small baseline elevation means all rings always show their arc silhouette
  // faintly, establishing the topology's structure even at rest.

// CROSS-RING ARC HEIGHT
cross_ring_arc_scale:   float  [0.5, 2.0]       default: 1.0
  // Multiplier on the arc height for edges crossing multiple rings.
  // At 1.0, default buildChaseCurve() behavior.
  // At 1.5, long-distance telemetry flows have dramatically arced paths —
  // the external→splunk-es path, for instance, would be visibly bowed.
  // Useful for making cross-ring communication legible at full canvas scale.
```

---

## 4. Visual States Framework

States are unchanged from V2 in definition. The following notes describe how each state looks at full canvas scale with the actual topology.

**Baseline:** 47 nodes as small dark circles with dim colored rings. ~110 edges as neutral navy strands, dotted edges barely visible, solid edges forming the structural skeleton. No gradient windows active. Chase particles move continuously on all edges at baseline rate. The SOC platform ring is the most visually complex area (highest in-degree density) but reads as calm at baseline. The external threat nodes at the canvas edges are visible but unremarkable. The system reads as infrastructure at rest.

**Ingress:** For a security scenario, the external threat node (e.g., `threats` at col 10, row 0) activates. A bright chase particle enters from the top-right area of the canvas, traveling through the dashed edge to dmz or umbrella. This is a visual event in the perimeter region of the wall — top-right becomes the focal point. The fan around the ingress node briefly illuminates.

**Propagation:** The attack path cascades leftward and inward across the canvas. Each activated node flares in sequence. The path from perimeter (right-ish, top-ish) through network enforcement (distributed across the canvas center) toward application (mid-center) traces a diagonal narrative arc across the 2:1 canvas. Viewers' eyes follow the cascade.

**Anomaly:** The compromised node (e.g., `app-server`) goes to full anomaly state. Its region of the canvas becomes the spotlight — nearby strands dim to near-invisible, the anomaly node and its connected edges take on full-saturation magenta gradient windows. At full canvas scale this reads as a region of the wall going "hot" while the rest dims.

**Intervention:** Splunk SOAR activates (represented by the SOAR→fw-perimeter dashed edge becoming the intervention path). The dashed path lights up with the scenario's accent color. The contained paths (edges from the compromised node) go dashed. A visual containment boundary is implied by the transition.

**Resolution:** The hotspot cools. Gradient windows retreat. The canvas returns to the neutral strand field of baseline over 4–5 seconds.

---

## 5. Full Canvas Composition Rules

These rules govern how the complete topology is laid out and how it fills the 2:1 canvas.

**The canvas has four visual zones:**

Zone 1 — Perimeter (left and right extreme columns, cols 0 and 10–11): External threat nodes, user populations, partner/SaaS connections. Low node count, sparse strand density. These zones should feel like the edges of the observable world — present but not dominant.

Zone 2 — Border layer (cols 1–2 left, cols 8–9 right): Enterprise edge and outer network enforcement nodes. Campus, branch, DMZ, firewalls, SASE, Umbrella. This is where perimeter security controls sit. Medium node count, moderate strand density. The left-side fan from `fw-perimeter` and `sdwan`, and the right-side fan from `umbrella` and `secure-access`, will be the primary visual features of this zone.

Zone 3 — Inner enforcement and application (cols 3–8): The densest region. Network enforcement nodes share this space with application nodes and the SOC platform. This zone contains the highest edge density (~60% of all edges pass through here) and will be the most visually active area of the wall under any scenario. The hub nodes in this zone (`splunk-es`, `otel`, `backend`, `cisco-xdr`, `nexus`) will produce the richest fan and arc textures.

Zone 4 — Core (cols 5–6, rows 2–3): Four nodes — identity, core-data, business systems, crown jewel assets. Minimal strand density at baseline but the highest visual priority during escalation scenarios. These nodes should be the brightest point on the canvas when an attack reaches the crown jewel.

**Fill strategy:**

The topology in its current grid placement fills the canvas naturally. No artificial padding or scaling beyond the current layout engine behavior is required. The pseudo-3D projection (yaw −0.62, pitch 0.30) should remain as the default camera — it distributes the concentric structure horizontally into the 2:1 canvas without over-compressing the vertical dimension.

**What should read at each distance:**

At 8m: Two regions of the canvas. Perimeter (outer) and core (inner). During events, the lit path between them.

At 5m: Six ring layers. The arc silhouettes of each ring as a visual layer within the topology.

At 3m: Individual hub fan patterns. Gradient window positions on named paths. Node clusters with visible ring type colors.

At 1.5m: Individual strands, node labels (if enabled), annotation callouts, strand shimmer.

---

## 6. 3D Evolution Path

The 2D system is designed as a projection of a 3D model. Every design decision is made so the transition from 2D to 3D requires only the addition of a third axis — the visual language itself (strand behavior, gradient clamping, node anatomy, color system) is unchanged.

**The 3D model:**

The enterprise topology maps naturally to a set of concentric cylindrical shells. Each trust ring becomes a cylinder:

```
Ring          → 3D Cylinder Radius
External      → R = 5.0  (outermost)
Enterprise Edge → R = 3.8
Network Enforcement → R = 2.8
Application   → R = 1.9
SOC Platform  → R = 1.1
Core          → R = 0.4  (innermost)
```

Nodes are positioned on the surface of their cylinder. Edges are paths through the interior — they pierce through cylinder shells to connect nodes across rings.

**Default 3D camera position:** Above and slightly in front of the system, looking down at a shallow angle into the core. Think of the camera floating above the outermost ring at 45° elevation, looking inward. From this position:

- The outer ring (external) is near and large — its arc is wide and close
- The core ring is distant and small — its cluster is tight and recessed
- All intermediate rings are visible as concentric circles receding into the center

From this camera angle, the arc silhouette texture is the natural appearance of each ring's node distribution. The fan texture is the natural appearance of edges radiating from hub nodes in 3D space. Both reference images are essentially photographs of this 3D system taken from specific camera angles.

**The basketball arc reference** is essentially a cross-section view of one cylinder — the camera positioned at the equator of the cylinder looking along the surface, so the vertical strands rising from the ring surface form the arc shape.

**The radial fan reference** is essentially a view from inside the cylinders looking outward through a hub node toward the perimeter — the paths radiating from the hub fan outward as they traverse multiple shells.

**2D design decisions that enable 3D migration:**

Every node has a `ringId` attribute — this maps directly to cylinder radius in 3D. No additional data is needed.

Every edge is defined as `{from, to}` node references — in 3D these become 3D curve paths through the cylindrical volume. The Bézier control point generation (`buildChaseCurve()`) becomes a 3D curve generation function; the math extends directly.

The pseudo-3D projection parameters (yaw, pitch, depth, perspective) are externalized camera controls, not baked geometry. In 3D, these become actual camera position and orientation values. The values currently in use (yaw −0.62, pitch 0.30) correspond approximately to a 3D camera at azimuth 35° and elevation 17° — a gentle top-down angled view.

The gradient clamping is path-parameter-based (t=0 at source node, t=1 at target node). This is already 3D-ready — the gradient window floats in 3D space as the path parameter progresses through the volume.

**Migration sequence:**

Step 1 (current): 2D canvas with pseudo-3D projection. Trust rings as logical groups; positions computed by layout engine and projected through yaw/pitch/perspective. This is the production system.

Step 2: True 3D scene graph. Nodes placed on cylinder surfaces in 3D space. Edges as 3D Bézier curves. Camera as a moveable object. Gradient clamping evaluated in 3D path space. Visual language identical to Step 1 — only the spatial model changes.

Step 3: Camera animation and interactive camera control. Scenarios could drive camera behavior — during an anomaly event, the camera slowly drifts toward the affected node, increasing apparent scale. During resolution, it pulls back to the overview position.

Step 4: Physical depth cues. Nodes closer to the camera in 3D render larger. Strands farther from camera render slightly lighter (aerial perspective on off-white ground). The arc and fan patterns become more dramatic because the perspective foreshortening creates actual depth relationships that the 2D system only approximates.

**Design constraint for 3D readiness:**

Do not hard-code any visual property to a screen-space coordinate. Color, opacity, scale, and strand count must all be computed from node/edge attributes (ring, type, state, degree) rather than from pixel position on canvas. This constraint is already effectively observed in the current generative.js implementation — enforcing it explicitly ensures the 2D → 3D migration requires no visual redesign.

---

## 7. Data Mapping Schema

Updated for full topology context:

```json
{
  "canvas": {
    "coordinate_space": { "width": 12, "height": 6 },
    "tile_mapping": "1 unit = 1 tile (cols 0-11, rows 0-5)",
    "safe_zone": { "x": [0.5, 11.5], "y": [0.3, 5.7] },
    "seam_columns": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    "seam_rows": [1, 2, 3, 4]
  },
  "background": {
    "color": "#F2F1EC",
    "grain": { "type": "perlin_noise", "frequency": 1.0, "opacity": 0.07 }
  },
  "topology": {
    "nodes": {
      "source": "components.json rings[].nodes",
      "fill": "#0D1A2E",
      "ring_color": "TYPE_COLOR[node.type]",
      "base_radius": "nodeRadiusByType(node.type)",
      "ring_weight_modifier": "ring_weight_curve[ring_index]"
    },
    "edges": {
      "source": "components.json edges",
      "style_map": {
        "solid": { "strand_count": "1.5–2.5", "opacity_multiplier": 1.0 },
        "dashed": { "strand_count": "1.0–1.5", "opacity_multiplier": 0.85, "dash": "6px/4px" },
        "dotted": { "strand_count": "0.5–1.0", "opacity_multiplier": 0.60, "dash": "2px/4px" }
      },
      "hub_amplification": {
        "threshold_degree": 5,
        "strand_multiplier": 1.8
      }
    }
  },
  "gradient_clamping": {
    "color_fade_in_start": 0.30,
    "color_peak": 0.60,
    "color_fade_out_start": 0.80,
    "color_neutral_end": 0.92,
    "strand_stagger": 0.06,
    "neutral_color": "#1B2B4A",
    "neutral_opacity": {
      "solid": 0.27, "dashed": 0.22, "dotted": 0.13
    }
  },
  "states": {
    "baseline":     { "signal_intensity": 0.0, "gradient_window_visible": false },
    "ingress":      { "signal_intensity": 0.5, "transition_ms": 400, "scope": "single_edge" },
    "propagation":  { "signal_intensity": 0.65, "cascade_delay_ms": 300, "scope": "expanding_subgraph" },
    "anomaly":      { "signal_intensity": 0.9, "transition_ms": 200, "unaffected_opacity": 0.08 },
    "intervention": { "signal_intensity": 0.6, "line_style": "dashed", "transition_ms": 800 },
    "resolution":   { "decay_duration_ms": 4000, "gradient_retreat_direction": "t0.92_backward" }
  },
  "scenarios": {
    "color_assignment": {
      "source": "routes.json routeColors",
      "palette": ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24"],
      "max_concurrent": 4
    }
  },
  "camera_3d_ready": {
    "current_2d": { "yaw": -0.62, "pitch": 0.30, "perspective": 0.90 },
    "equivalent_3d": { "azimuth_deg": 35, "elevation_deg": 17 },
    "cylinder_radii": {
      "external": 5.0, "enterprise-edge": 3.8, "network-enforcement": 2.8,
      "application": 1.9, "soc-platform": 1.1, "core": 0.4
    }
  }
}
```

---

## 8. Implementation Guidance

### Revised Architecture for Full Topology Rendering

The key architectural decision for full canvas rendering: everything is driven from the topology data, not from hardcoded visual configurations. The rendering pipeline takes `components.json` and `routes.json` as its sole inputs and derives all visual properties from node/edge attributes and real-time state.

**Hub node detection:** On topology load, compute in-degree + out-degree for every node. Nodes exceeding `hub_threshold_degree` receive the `hub_strand_multiplier` applied to their edge strand counts. This computation runs once at startup and is stored as a node attribute. The fan texture at splunk-es and fw-perimeter emerges automatically from their high degree values.

**Telemetry strand reduction:** Apply `telemetry_strand_multiplier` (0.75) to all dotted edges at strand spawn time. This prevents the 50+ telemetry flows from overwhelming the solid structural edges. At baseline, the telemetry flows should read as a fine texture behind the solid connection structure — present, active, but subordinate.

**Ring arc silhouette enhancement:** Set `ring_baseline_elevation` (0.08) as a minimum strand height for strands originating within each ring. This ensures that even at zero activity, each ring has a faint visible arc — the topology structure is readable at all times, not only during events.

**Seam-aware node placement:** After layout engine produces node positions, run a seam-avoidance pass: for any node whose screen position falls within 1.5% of canvas width from a seam column (or 2% of canvas height from a seam row), nudge the position by 2% away from the seam. This is a lightweight post-process that prevents the most critical elements from sitting on module boundaries.

### TouchDesigner / Notch

All V2 guidance applies. Add:

**Hub fan rendering:** Use a per-node `strand_count_multiplier` attribute, computed from degree data at load time. Drive the strand instancing parameter from this attribute — hub nodes automatically produce more strands per edge.

**Telemetry layer:** Render dotted edges as a separate pass with its own compositing layer at 75% of the solid edge opacity. Compositing separately allows the telemetry field to be faded as a unit during anomaly spotlight behavior — when `dim_unaffected_to = 0.08`, the telemetry layer dims proportionally.

**Performance at full topology count (47 nodes, ~110 edges, ~1.8 strands average):**
Estimated strand count at baseline: 110 × 1.8 × 0.75 (telemetry reduction) ≈ 175 total strands. This is well within the 2000-strand performance budget. The system has significant headroom for event-driven strand bursts.

### WebGL / Three.js

All V2 guidance applies. Add:

**3D-ready node storage:** Store every node with `{id, ringId, x, y, z_depth, type, degree}`. The `z_depth` value maps to the cylinder radius for the node's ring. In the current 2D system, this drives the pseudo-3D projection depth offset. In the future 3D system, it becomes the actual 3D radius.

**Topology graph structure:** Maintain a proper graph data structure in JavaScript (adjacency list or edge list) rather than a flat array of edges. This enables efficient subgraph queries during scenario events — "which edges are in the attack path?" requires graph traversal, not array scanning.

---

## 9. LED Optimization

All V2 content applies without change. Additions:

**Seam awareness at production topology scale:** With 47 nodes distributed across 12 columns, approximately 4–5 nodes will naturally fall near tile seam positions before the seam-avoidance pass. The post-process nudge is essential — without it, tile-to-tile luminance variance will bisect node circles, producing a visibly broken appearance in physical installation.

**White background uniformity at 12×5 scale:** A wall of this area running at 65–70% white brightness will likely show tile-to-tile variation of ±3–5% despite calibration. The grain texture at 6–8% opacity effectively masks variation below 6%. This is the primary practical reason to use Perlin noise grain rather than a pure #F2F1EC solid background — the aperiodic texture breaks up the perception of tile boundaries without visible patterning.

---

## 10. Explicit Assumptions

All V1 and V2 assumptions apply. Additions for V3:

1. **Arc and fan textures do not require explicit composition logic.** They emerge from the topology structure rendered through the strand system. If the arc silhouette is not readable at full canvas scale, the issue is either insufficient strand density per ring or insufficient ring_baseline_elevation — both are tunable parameters. Do not introduce explicit arc-drawing routines.

2. **The 2D → 3D transition is architectural, not visual.** The visual language is already 3D-ready. The transition requires replacing the 2D layout engine + pseudo-3D projection with a true 3D scene graph. Estimated transition scope: the rendering pipeline and scene math. Data model, state machine, event protocol, and all visual parameters remain unchanged.

3. **The topology's hub nodes will produce fan texture without special handling** beyond the `hub_strand_multiplier`. splunk-es (degree 12+) will be the most visually distinctive node on the canvas at full rendering. Its inbound fan of gradient-clamped strands from across the topology will be the signature image of this system — the visual equivalent of Splunk's intelligence platform receiving data from everywhere.

4. **Dotted telemetry edges at the specified density (0.75×) will produce a fine grain texture in the SOC platform zone**, where most telemetry terminates. This is desirable — it gives the SOC zone a background "intelligence hum" that distinguishes it from the structural enforcement zone even at baseline.
