# Phase 10C — Milestone 2
## Research Assistant & Scholarly Copilot

This milestone adds a project-local, evidence-grounded scholarly research assistant.

### Included
- Semantic index over OCR Studio JSON, Markdown and text research data
- Retrieval-grounded answers with expandable source evidence and confidence
- Persistent project conversations
- Research notebook entries and evidence bookmarks
- Reusable scholarly prompt library
- Chicago, MLA, APA and SBL citation generation in the service layer
- HTML and JSON conversation export
- Sidebar route: **Scholarly Copilot**

### Storage
`<project>/.ocr-studio/assistant/`
- `conversations.json`
- `notebooks.json`
- `prompts.json`
- `bookmarks.json`
- `semantic-index.json`
- `exports/`

### Build
From `ocr-studio/desktop` run:

```powershell
npm install
npm run build
npm run dev
```

The assistant is deliberately retrieval-grounded and does not invent evidence when the index has no supporting result.
