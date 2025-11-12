# Whiteboard Rendering Add-on

This directory introduces a focused set of helpers so the Remotion renderer can animate whiteboard sketches that come straight from LLM output.

## SVG Hint Command Reference

Each chapter with `diagram.visualType: "whiteboard"` should provide an ordered array of `svgHints`. Supported commands are:

- `{ "cmd": "moveTo", "x": 120, "y": 180 }` – start a new stroked path at the given coordinates.
- `{ "cmd": "lineTo", "x": 320, "y": 180 }` – extend the active path with a straight segment.
- `{ "cmd": "rect", "x": 120, "y": 120, "w": 220, "h": 120 }` – draw a rectangle path.
- `{ "cmd": "circle", "x": 520, "y": 160, "r": 60 }` – draw a circular path.
- `{ "cmd": "text", "x": 140, "y": 160, "text": "Class: Car" }` – render a text label (revealed after strokes finish).
- `{ "cmd": "bezier", "points": [{"x":140,"y":280},{"x":220,"y":340},{"x":340,"y":320}] }` – add a cubic Bézier curve.
- `{ "cmd": "arc", "x": 420, "y": 240, "rx": 32, "ry": 24 }` – extend the active path with an elliptical arc.

Optional `style` fields can override `stroke`, `strokeWidth`, `fill`, `opacity`, `strokeLinecap`, `strokeLinejoin`, or set `sketchy: true` for dashed strokes.

## Focus Events and Pointer Behaviour

Use `diagram.focusEvents` to choreograph the pointer/pen:

```json
{
  "time": 3.0,
  "action": "trace",
  "target": { "cmdIndex": 4 }
}
```

- `time` is measured in seconds from the start of the chapter.
- `action` can be `point`, `tap`, or `trace`.
- `target` may reference `cmdIndex` (matching the svgHints array index) or absolute `x/y` coordinates.
- During `trace`, the pointer follows the selected command for ~0.6 s; `tap` adds a bounce highlight.

If you use Deepgram timestamps, simply map the timestamp (seconds) to the `time` field. The renderer converts these to frames internally via `timeSecToFrame`.

## Generating LLM Output

When prompting Gemini/Cursor for chapters, include guidance such as:

> "Produce JSON for a chapter that uses `visualType: 'whiteboard'`. Provide `svgHints` as an ordered list of drawing commands (moveTo, rect, text, lineTo). Provide `focusEvents` with `time` in seconds and `action` of `point|tap|trace` referencing hint indices."

## Previewing the Whiteboard Scene

1. Validate your JSON:
   ```bash
   node tools/validate-whiteboard-json.js src/sample-whiteboard.json
   ```
2. Launch Remotion with the sample chapter:
   ```bash
   npx remotion preview --props="{\"contentPath\":\"src/sample-whiteboard.json\"}"
   ```
   or wire the sample into your existing `loadJson` helper.
3. Look for the new `WhiteboardFrame` branch in `Video.jsx`. Chapters with `visualType: "whiteboard"` automatically render the animated sketch, while other diagrams still use the ERD/SVG code paths.

## Development Notes

- The whiteboard renderer shares canvas dimensions from `styleConfig` (960×540 @ 30 fps).
- Stroke durations scale with path length, leaving ~0.8 s buffer for pointer callouts.
- `src/hand-pen.svg` supplies the pointer asset. Replace it with your preferred stylus if required.
- The helper module `src/whiteboard-utils.js` is safe to reuse inside CLI tools or schema validation.

Happy sketching! 🚀
