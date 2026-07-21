# OCR Studio Phase 6E.2.6A — Revision History Foundation

This release adds page-level revision history for OCR word-index review.

## Features

- Automatic page snapshot before every word review action
- Automatic page snapshot after correction, verification, ignore, or reset
- Persistent revision storage under `.ocr-studio/revisions/`
- Revision timeline in the Review tab
- Compare the two latest revisions
- Added, removed, and modified word counts
- Restore any earlier revision
- Automatic safety backup before restore
- SHA-256 page hashes to avoid duplicate snapshots
- Revision metadata: action, actor, timestamp, comment, source revision

## Storage layout

`.ocr-studio/revisions/<document-id>/page-00001/rev-*.json`

## Usage

1. Open a project and select Review.
2. Open an indexed page and select a word.
3. Save, verify, ignore, or reset the word.
4. Use Page revision history below the correction editor.
5. Click Compare latest or Restore.

Restoring a revision first creates a backup of the current page.
