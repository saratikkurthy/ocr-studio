# Phase 10B — Milestone 3
## Manuscript Witness & Collation Workbench

This milestone adds a workspace-wide manuscript catalog and collation workflow to OCR Studio.

### Features
- Manuscript witness catalog with siglum, repository, shelfmark, script, language, material, date, region, provenance, condition, notes, and image-path metadata.
- Witness-family/group management.
- Edition-based verse alignment by book, chapter, and verse number.
- Side-by-side witness reading editor.
- Adopted-reading editor.
- Automatic variant classification: agreement, orthographic, substitution, lexical, addition, omission, and transposition.
- Persistent collation history and workspace variant index.
- HTML, CSV, and JSON exports.
- Sidebar navigation and Electron IPC integration.

### Storage
`<workspace>/.ocr-studio/manuscripts/`

- `witnesses.json`
- `witness-groups.json`
- `collations.json`
- `variant-index.json`
- `exports/`
