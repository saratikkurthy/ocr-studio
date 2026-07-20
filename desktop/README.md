# OCR Studio Phase 6D.3 — Publishing Queue, Profiles, and Multi-Format Export

This package includes all Phase 6D.1 and Phase 6D.2 functionality.

## Replace

- `electron/main.js`
- `electron/preload.cjs`
- `electron/publish_searchable_pdf.py`
- `src/types/electron.d.ts`
- `src/pages/projects/ProjectDetailPage.css`
- `src/pages/projects/project-detail/ReviewTab.tsx`

## Restart

```powershell
Ctrl + C
npm run dev
```

## Added

### Publication profiles

Save the current publication settings as named profiles such as:

- Archive
- Web
- AI Training
- Research
- Digital Edition

Profiles include word-inclusion rules and all selected export formats.

Profiles persist in:

```text
ocr-word-index/publication-profiles.json
```

### Persistent publishing queue

- select multiple indexed documents
- add them to one queue
- sequential background processing
- persistent status across app restarts
- progress display
- cancel queued or running jobs
- retry failed or cancelled jobs
- remove completed jobs
- resume pending jobs after restart
- open completed output folders

Queue state persists in:

```text
ocr-word-index/publication-queue.json
```

### Additional formats

In addition to TXT, JSON, CSV, HTML, searchable PDF, and review reports:

- TSV
- Markdown
- hOCR
- ALTO XML 4
- PAGE XML 2019

These formats include corrected text, confidence, page numbers, word IDs, and
bounding-box coordinates where applicable.

## Test

1. Open the Review workspace.
2. Select output formats including one of TSV, Markdown, hOCR, ALTO XML, or PAGE XML.
3. Enter a profile name and click `Save current options`.
4. Click `Load profiles`.
5. Select the profile and confirm its options are restored.
6. Under Publishing Queue, select two indexed documents.
7. Click `Add 2 to queue`.
8. Click `Refresh queue` while jobs are running.
9. Confirm each job becomes Completed.
10. Open each output folder.
11. Confirm all selected formats were generated.
12. Queue another job and cancel it.
13. Retry the cancelled job.
14. Restart OCR Studio and click `Resume queue`.
15. Confirm profiles and queue history remain available.

## Scope

This milestone uses a persistent sequential queue. That is intentional for
stability when publishing large books. True parallel worker limits and
incremental page-only regeneration are planned for the next performance phase.
