# OCR Studio Phase 7.0D

## Cross-Project Knowledge Graph & Manuscript Comparison

This release adds a workspace-level comparison system on top of project knowledge graphs.

### Features
- Select two or more projects for comparison
- Canonical multilingual entity registry
- Alias-based automatic entity matching
- Human confirmation/rejection of suggested entity links
- Cross-project relationship evidence grouping
- Relationship conflict detection
- Unique-entity detection
- Variant review workflow with scholarly notes
- Comparison history and analytics
- JSON and HTML report export

### Storage
Workspace comparison records are saved at:

`.ocr-studio/cross-project-graph/workspace-graph.json`

### Validation
- Electron service syntax: passed
- Electron main-process syntax: passed
- Preload syntax: passed
- TypeScript compilation: passed
- Vite production build: passed
