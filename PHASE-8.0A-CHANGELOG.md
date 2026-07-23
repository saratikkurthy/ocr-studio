# OCR Studio Phase 8.0A — Research Workbench Foundation

Implemented and build-verified on July 21, 2026.

## Added
- Research Workbench sidebar module and route
- Workspace-level notebook persistence
- Notebook create, edit, status, search, delete, and export
- Markdown research editor with autosave on blur
- Evidence library linked to projects/documents/pages
- Evidence types for passages, pages, entities, relationships, timeline events, comparisons, and AI conversations
- Open-source and remove-evidence actions
- Markdown and JSON notebook exports

## Storage
`<workspace>/.ocr-studio/research/notebooks.json`

## Validation
- `node --check electron/researchWorkbenchService.js`
- `node --check electron/main.js`
- `node --check electron/preload.cjs`
- `npm run build` (TypeScript + Vite) passed
