# Questionnaire document viewer

Vendored npm packages: `mammoth@1.13.0` (BSD-2-Clause) and `pdfjs-dist@6.4.299` (Apache-2.0).
Their license files are included in their respective directories. Exact distributed file hashes are in `questionnaire-dependencies.json`.

Only the browser build of Mammoth and the legacy PDF.js display/worker builds, fonts, CMaps and WASM assets are shipped. No CDN or external document conversion service is used. These libraries are loaded only when a questionnaire file is opened.

DOCX conversion uses `extractRawText` and renders with `textContent`; document HTML, links, scripts and macros are never inserted into the page. PDF.js displays pages on canvas and extracts text for a separate plain-text editorial copy. Original uploads are immutable. Scanned PDFs without a text layer require manual transcription; this viewer does not run OCR.
