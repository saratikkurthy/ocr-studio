# AI Foundation 1.0 — Reliable Manuscript Index

This release repairs and strengthens the local manuscript indexing pipeline used by the AI Manuscript Assistant and Research Copilot.

## Improvements

- Creates `.ocr-studio` automatically in the selected workspace.
- Discovers projects both from OCR Studio's recent-project registry and from `project.json` files inside the workspace.
- Handles Windows path casing and separator differences.
- Reads page-level OCR data from `ocr-word-index/<documentId>/page-*.json`.
- Falls back to `.txt` and `.md` OCR outputs under `OCR`, `Processed`, and `Export` when a word index is unavailable.
- Prefers corrected OCR words where present.
- Writes:
  - `.ocr-studio/manuscript-index.json`
  - `.ocr-studio/manuscript-index-diagnostics.json`
- Shows project-by-project indexing diagnostics in the AI Assistant.
- Provides an Open Index File action.
- Prevents searches against a missing or empty index.

## Required workflow

1. Open OCR Studio.
2. Open **AI Manuscript Assistant**.
3. Select the correct workspace.
4. Click **Build Index**.
5. Confirm the diagnostic table reports pages and passages.
6. Test a keyword known to occur in the OCR text.
7. Connect Ollama only after retrieval is working.

If a project reports zero pages, open that project and build its Word Index first.
