# OCR Studio Phase 8.0D — Evidence-Grounded Research Assistant

Adds a local Ollama research assistant that retrieves indexed manuscript passages before answering.

## Features
- Workspace, collection, notebook, and research-canvas scopes
- Retrieval-first answers using the manuscript index
- Mandatory bracketed evidence citations
- Hallucination guard when no evidence is found
- Confidence score based on evidence count, citation coverage, and OCR confidence
- Clickable evidence dossier and project navigation
- Persistent research sessions
- Suggested follow-up research questions
- Markdown session export

Data is stored in `<workspace>/.ocr-studio/ai/research-assistant.json`.
