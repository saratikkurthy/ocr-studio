# OCR Studio Phase 6E.2.2 — Cross-Project Search

This package includes Phase 6E.2.1 Collections Manager and adds a new
workspace-wide search module.

## Run

```powershell
npm install
npm run dev
```

## New navigation

```text
Library Search
```

## Search scopes

- Entire workspace
- A selected collection

## Search modes

- All matching words
- Confidence below 60%
- Confidence below 35%
- Unreviewed words
- Corrected words

The search reads the existing page-level OCR word indexes stored under each
project's `ocr-word-index` folder. It uses corrected text when available and
falls back to original OCR text.

## Result details

Each result shows:

- Project
- Document
- Page
- Indexed word
- Nearby word context
- Language
- Confidence
- Review status
- Original/corrected comparison
- Open-project action

## CSV export

Search results can be exported to:

```text
<workspace>/.ocr-studio/search-exports/
```

## Updated files

- `electron/main.js`
- `electron/preload.cjs`
- `src/App.tsx`
- `src/layouts/MainLayout.tsx`
- `src/types/electron.d.ts`

## New files

- `electron/crossProjectSearchService.js`
- `src/pages/Search/CrossProjectSearchPage.tsx`
- `src/pages/Search/CrossProjectSearchPage.css`

## Test checklist

1. Start OCR Studio.
2. Confirm `Library Search` appears in navigation.
3. Select a workspace.
4. Search for a word known to exist in more than one project.
5. Confirm project, document, page, context, and confidence appear.
6. Select a collection and repeat the search.
7. Confirm results are restricted to that collection.
8. Test the low-confidence and unreviewed modes without a search term.
9. Test the corrected-words mode.
10. Filter displayed results by project and language.
11. Open a result's project.
12. Export results to CSV.
13. Open the generated CSV.
14. Restart OCR Studio and repeat the search.

## Notes

- Projects must already have word indexes for results to appear.
- Search is local and does not require internet access.
- The result cap prevents very large searches from overwhelming the UI.
