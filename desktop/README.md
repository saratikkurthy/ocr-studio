# OCR Studio Phase 6C.3 — Correction Rules and Batch Undo

## Replace

- `electron/main.js`
- `electron/preload.cjs`
- `src/types/electron.d.ts`
- `src/pages/projects/ProjectDetailPage.css`
- `src/pages/projects/project-detail/ReviewTab.tsx`

This package includes the complete working Phase 6C.2 code.

## Restart

```powershell
Ctrl + C
npm run dev
```

## Added

### Correction Rule Library

- Save the selected OCR word and current corrected text as a reusable rule
- Store a confidence limit with each rule
- Load a rule directly into the correction and batch-preview workflow
- Enable or disable rules without deleting them
- Delete obsolete rules
- Rules are stored per document in:

```text
ocr-word-index/correction-rules.json
```

### Transactional Batch Undo

- Every batch correction now creates one transaction
- Captures the previous status, corrected text, and verification timestamp for every changed word
- Batch History panel
- Undo the entire batch with one action
- Restores each affected word to its exact prior review state
- Prevents the same transaction from being undone twice
- Undo actions are also recorded in `correction-history.json`
- Transactions are stored in:

```text
ocr-word-index/batch-correction-transactions.json
```

## Test

1. Select a word and enter corrected text.
2. Choose a confidence threshold.
3. Click `Save current rule`.
4. Click `Load rules` and confirm the rule appears.
5. Select the rule and preview matching occurrences.
6. Apply a batch correction.
7. Click `Load history`.
8. Click `Undo batch`.
9. Confirm all affected words return to their previous statuses and text.
10. Restart OCR Studio and verify rules and transaction history remain.

## Safety

A batch undo restores each individual word from the transaction snapshot. It
does not guess the previous state from correction history.

The next milestone is Phase 6D — publishing approved corrections into revised
TXT, searchable PDF, and review-report exports.
