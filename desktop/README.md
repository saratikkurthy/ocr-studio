# OCR Studio Phase 6E.1 — Collaborative Review Workflow

This package includes all functionality from Phase 6D.1 through Phase 6D.5.

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

### Review team

Create local review participants with roles such as:

- Reviewer
- Senior Reviewer
- Language Expert
- Editor
- Administrator

Reviewers can be activated or deactivated without deleting their history.

### Review assignments

Assign the currently selected document to a reviewer.

Supported scopes:

- Entire document
- Page range

Priorities:

- Low
- Normal
- High
- Urgent

Assignment states:

- Assigned
- In Progress
- Blocked
- Completed

Starting and completion timestamps are recorded automatically.

### Page and word comments

Add comments against:

- the selected document
- the current review page
- the currently selected OCR word, when one is selected

Comments support:

- author
- timestamp
- open/resolved status
- resolved-by information
- reopening after resolution

### Collaboration activity trail

OCR Studio records activities such as:

- reviewer creation
- reviewer activation/deactivation
- assignment creation
- assignment status changes
- comment creation
- comment resolution
- comment reopening

The latest activity is shown inside the Review workspace.

### Collaboration dashboard

The panel displays:

- active reviewers
- open assignments
- unresolved comments
- completed assignments

### Persistence

All collaboration data is stored locally in:

```text
ocr-word-index/review-collaboration.json
```

No cloud account or server is required.

### Review report export

Click `Export report` to create:

```text
Export/
  Review/
    collaborative-review-<timestamp>.json
```

The report contains:

- reviewer roster
- assignments
- comments
- activity trail
- summary counts
- timestamps and statuses

## Test

1. Open the Review workspace.
2. Add two reviewers with different roles.
3. Deactivate and reactivate one reviewer.
4. Select a document.
5. Assign the entire document to one reviewer.
6. Create a page-range assignment for the second reviewer.
7. Change one assignment to `In Progress`.
8. Change another assignment to `Completed`.
9. Navigate to a page and optionally select a word.
10. Enter your name and add a review comment.
11. Resolve the comment.
12. Reopen the comment.
13. Confirm the summary counters update.
14. Confirm recent activity records each action.
15. Click `Export report`.
16. Open the generated JSON file.
17. Restart OCR Studio and confirm reviewers, assignments, comments, and history remain available.

## Scope

This phase provides collaborative workflow and auditability on a shared local
project folder. Real-time multi-computer synchronization, user authentication,
and conflict resolution require a server-backed collaboration phase and are not
included yet.
