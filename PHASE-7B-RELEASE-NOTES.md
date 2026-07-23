# OCR Studio Phase 7.0B — AI Relationship Discovery

## Added
- Local Ollama relationship extraction from reviewed OCR pages.
- Strict evidence-first JSON prompt and safe response parsing.
- Rule-based relationship extraction as a non-AI baseline.
- Human approval/rejection queue for every suggested entity and relationship.
- Relationship evidence inspector with source document, page, quote, confidence, and extraction method.
- Network filters for entity type and verification status.
- Relationship analytics: most-connected entities, entity types, relationship types, isolated entities, and verified/suggested counts.
- AI extraction job history and per-page error recording in the graph data.
- Expanded graph schema version 2 with `aiExtractions` and extraction metadata.

## Ollama defaults
- Endpoint: `http://127.0.0.1:11434`
- Model: `llama3.2:3b`
- Context: 4096
- Timeout: 120 seconds per page
- Default run: 12 pages, configurable in the UI

## Storage
`<project>/.ocr-studio/knowledge-graph/graph.json`

## Validation
- Electron knowledge graph service syntax passed.
- Preload syntax passed.
- TypeScript compilation passed.
- Vite production build passed.
