# Phase 6E.2.5A — Local Manuscript Index

This milestone establishes the local-first retrieval foundation for the AI Manuscript Assistant.

## What is implemented

- Workspace-wide OCR passage chunking
- Corrected-text-first indexing
- Local BM25-ranked retrieval with phrase and query-coverage boosts
- Collection-scoped retrieval
- Project, document, page, language, OCR confidence, and correction metadata
- Exact page-level citations in every result
- Private local index storage; no cloud service is called
- Configurable passage size and overlap
- New **AI Manuscript Assistant** navigation page

## Local data

The generated index is stored inside the selected workspace:

`.ocr-studio/manuscript-index.json`

Rebuilding the index safely replaces the previous index.

## How to use

1. Open **AI Manuscript Assistant** from the sidebar.
2. Select a workspace.
3. Click **Build Index**.
4. Enter a question or concept and click **Retrieve Evidence**.
5. Use **Open Project** to inspect the cited source.

This phase performs retrieval only. Phase 6E.2.5B will add local Ollama answer composition and conversation history while retaining these citations.
