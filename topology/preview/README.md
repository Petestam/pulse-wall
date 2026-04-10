# Master topology preview (client sign-off)

Static HTML/SVG viewer for [`../components.json`](../components.json) and [`../routes.json`](../routes.json).

## Run locally

Browsers block `fetch()` for local files when opened as `file://`. Serve the **`topology/`** directory (parent of this folder) so `components.json` and `routes.json` resolve:

```bash
cd topology
python3 -m http.server 8765
```

Open `http://localhost:8765/preview/index.html`.

## Controls

- **Pan:** drag the diagram.
- **Zoom:** mouse wheel (centers on cursor).
- **Tile grid:** toggle 12×5 cell boundaries (500 mm tile pitch context).
- **Routes:** select up to **four** of twelve branches; colors match the route legend.
- **Preset:** loads a mixed four-route demo selection.
