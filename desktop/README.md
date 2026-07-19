# OCR Studio Automatic Queue Worker — Complete Replacement Files

Replace:
- electron/main.js
- electron/preload.cjs
- src/types/electron.d.ts
- src/pages/projects/ProjectDetailPage.tsx
- src/pages/projects/project-detail/QueueTab.tsx

Append:
- src/pages/projects/ProjectDetailPage.queue-worker.css

to your existing src/pages/projects/ProjectDetailPage.css.

Then restart:
npm run dev

Behavior:
- Waiting jobs are processed sequentially.
- Status changes are persisted after every step.
- A failed PDF does not stop the remaining queue.
- Queue, documents, outputs, and history refresh live.
- Duplicate workers are blocked.
- Stop Queue safely terminates the active process and marks it Cancelled.
