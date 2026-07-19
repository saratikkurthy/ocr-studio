# OCR Studio Phase 6B.2 — Background Word-Index Jobs

This phase moves word indexing out of the blocking Review action and into a
persistent Electron background queue.

## Replace

- `electron/main.js`
- `electron/preload.cjs`
- `src/types/electron.d.ts`
- `src/pages/projects/ProjectDetailPage.tsx`
- `src/pages/projects/ProjectDetailPage.css`
- `src/pages/projects/project-detail/types.ts`
- `src/pages/projects/project-detail/ReviewTab.tsx`

## Restart

```powershell
Ctrl + C
npm run dev
```

## Added

- Quick Index and Full Index now enqueue immediately
- Review PDF selector stays usable while indexing runs
- Persistent queue in `word-index-jobs.json`
- One background word-index job at a time per project
- Live page and percentage progress
- Cancel queued or running jobs
- Retry failed or cancelled jobs
- Remove finished jobs
- Interrupted Running jobs are recovered as Queued after restart
- Existing `ocr-word-index` storage and manifest remain unchanged
- Background Job Center inside Review

## Test

1. Open Review and select a PDF.
2. Click `Quick Index`.
3. Immediately change the PDF dropdown and browse pages.
4. Confirm the Background Jobs card continues updating.
5. Close OCR Studio during a test job, restart, and reopen the project.
6. Confirm the interrupted job returns to `Queued` and resumes.
7. Test Cancel, Retry, and Remove.

## Scope note

This milestone provides persistent non-blocking word-index jobs. Pause/resume,
system CPU/RAM telemetry, desktop notifications, and generalizing the queue to
other job types are intentionally reserved for a later platform-wide Job Center.
