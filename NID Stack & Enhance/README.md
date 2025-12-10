# ID Stack & Enhance (simple HTML app)

This is a tiny single-page web app that accepts one or two ID photos and produces a single combined image stacked vertically. The UI includes subtle animations for previews and controls for a smoother experience.

New features added:
- Crop each input image before combining (independent-corner crop via modal).
- Drag-and-drop files onto the image zones.
- Progress indicator while processing.
- Export JPEG with adjustable quality.

How it works
- Upload Image 1 (top) and optionally Image 2 (bottom).
- Use "Crop Image 1/2" to crop via a modal. Draw a rectangle to choose crop area.
- If only one image is provided, the app will use it for both top and bottom when building the combined image (no duplication if you prefer only one side, see UI settings).
- Choose spacing, background color, output width, and output format/quality.
- Click "Combine" to produce a preview and a download link.

- Click "Combine" to produce a preview and a download link. The preview and adjusted preview use a short fade animation when updated.

Files
- `index.html` — UI and canvas
- `styles.css` — basic styling
- `script.js` — logic to read files, crop, draw on canvas, and create downloadable image

Run locally
1. Open `index.html` in your browser (double-click or File → Open). No server needed.
2. Upload images, crop if you like, and click "Combine".

Notes
- Works entirely client-side. No data sent to a server.
- Cropping is intentionally simple (draw a rectangle). It stores the crop in original image pixels.
- For large images or very large requested output width, browsers may consume significant memory.

License: MIT
