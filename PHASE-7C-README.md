# OCR Studio Phase 7.0C

Timeline, Geographic & Narrative Explorer

## Added
- Chronological event explorer with evidence inspector
- Manual event and place records
- Local schematic geographic canvas with optional latitude/longitude placement
- Ollama event/place discovery from reviewed OCR pages
- Rule-based event candidate extraction
- Human approval/rejection queue
- Narrative thread creation and event ordering
- Timeline/narrative JSON export
- Persistent project storage at `.ocr-studio/knowledge-graph/timeline-narrative.json`

## Validation
- Electron service syntax: passed
- Electron main/preload syntax: passed
- TypeScript no-emit compilation: passed
- Vite production build: passed

## Run
From `desktop`:
1. `npm install`
2. `npm run dev`
