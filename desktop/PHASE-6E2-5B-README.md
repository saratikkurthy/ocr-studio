# Phase 6E.2.5B — Ollama RAG and Conversation History

This release upgrades the local manuscript index into a private conversational research assistant.

## Added

- Ollama connectivity test and local model discovery
- Configurable Ollama endpoint, model, temperature, and evidence count
- Retrieval-augmented answer composition grounded in OCR passages
- Inline numbered citations and expandable source evidence
- Workspace and collection-scoped questions
- Persistent local conversation history
- Create, reopen, and delete conversations
- Corrected OCR remains preferred by the underlying manuscript index

## Local files

- `.ocr-studio/assistant-settings.json`
- `.ocr-studio/assistant-conversations.json`
- `.ocr-studio/manuscript-index.json`

## Setup

1. Install Ollama on Windows.
2. Run `ollama pull llama3.2:3b` (or another model).
3. Keep Ollama running.
4. Open AI Manuscript Assistant, click **Test Ollama**, select the model, and save settings.
5. Build or rebuild the manuscript index, then ask a question.

No manuscript content is sent to a cloud provider by this phase.
