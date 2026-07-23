# Phase 10.0A Milestone 3 — Editorial Decision Engine

Adds a complete review and audit workflow for verse-level editorial decisions.

## Features
- Proposed, Under Review, Accepted, Rejected and Superseded states
- Reviewer name and review notes
- Evidence attachments with source, locator, excerpt and strength
- Side-by-side comparison of up to four decisions
- Immutable revision snapshots for creation, edits, workflow transitions and evidence changes
- Restore any earlier decision state without losing the current state
- Edition statistics for accepted, rejected and pending decisions

## Storage
Each edition stores:
- `editorial-decisions.json`
- `editorial-decision-revisions.json`
- `editorial-decision-evidence.json`
