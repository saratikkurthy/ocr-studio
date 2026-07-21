# Phase 6E.2.3 — Duplicate Detection & Similarity Engine

## Added

- SHA-256 file fingerprints
- Corrected/original OCR text fingerprints
- Workspace-wide and collection-scoped scans
- Weighted similarity using OCR text, filename, page count, and file size
- Persistent `.ocr-studio/duplicate-registry.json`
- Duplicate dashboard with exact, highly similar, and possible-match filters
- Side-by-side document metadata comparison
- JSON, CSV, and HTML report export

## Use

1. Open **Duplicate Detection** in the sidebar.
2. Select a workspace and optionally a collection.
3. Choose a minimum similarity threshold.
4. Click **Find Duplicates**.
5. Expand a match to inspect its metrics or export the report.

## Notes

OCR similarity uses the existing `ocr-word-index` and prefers corrected words. Documents without OCR indexes can still be detected as exact file copies and compared by filename and file size.
