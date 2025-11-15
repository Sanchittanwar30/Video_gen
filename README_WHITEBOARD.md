# Whiteboard Image Generation

Whiteboard chapters now rely on Gemini to create progressive SVG sketches (converted to base64). No TLDraw snapshots or Nanobanana storyboards are required.

## Gemini Prompt Expectations

When Gemini drafts a chapter with `diagram.visualType: "whiteboard"` make sure it also includes a short list of `diagram.imagePrompts` describing the desired sketch (e.g. sticky notes, arrows, labels). The backend uses those hints—along with the chapter summary & key ideas—to request a sequence of SVG frames that progressively build the board.

Example minimal payload:

```json
{
  "diagram": {
    "type": "whiteboard",
    "visualType": "whiteboard",
    "imagePrompts": [
      "Blueprint of a class on the left, instance on the right with arrows connecting attributes"
    ]
  }
}
```

## Generation Flow

1. Gemini returns chapters with summaries, key ideas, and optional `imagePrompts`.
2. The backend calls Gemini again, requesting three incremental SVG frames (layout → relationships → final annotations). Each SVG is transformed into a `data:image/svg+xml;base64,...` URL.
3. If Gemini cannot produce any frame, we optionally fall back to Hugging Face (when `USE_HF=true`) using the primary prompt.
4. Remotion renders the frames through `ChapterVisual`, crossfading through the sequence to mimic a live sketch. If no frame is available, it falls back to a text card.

## Tips

- Keep prompts concise (1–2 sentences) but mention layout and key annotations.
- Prefer light backgrounds (`#F8FAFC`) with dark ink so the sketch resembles a whiteboard.
- You can add `diagram.whiteboard.callouts` to highlight terms; they’re surfaced in the UI but not required for image generation.

Happy sketching! ✏️
