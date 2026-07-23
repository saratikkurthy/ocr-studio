# Phase 9.0A — Corpus Intelligence & Semantic Explorer

## Added
- New Corpus Intelligence sidebar module and route.
- Workspace-wide corpus statistics sourced from the manuscript index.
- Theme discovery based on normalized corpus term frequency.
- Project, document, and language composition analytics.
- Semantic concept expansion for selected research concepts.
- Evidence-linked corpus search with source navigation.
- Concept evolution view grouped across projects and documents.
- Persistent analytics cache under `.ocr-studio/corpus-intelligence/analytics-cache.json`.
- Electron IPC handlers and preload bridge methods for corpus analytics.

## Validation
- Electron service syntax: passed.
- Electron main-process syntax: passed.
- Preload syntax: passed.
- TypeScript compilation: passed.
- Vite production build: passed.

## Dependency note
`npm install` reported three high-severity audit findings in the existing dependency tree. No automatic breaking upgrades were applied.
