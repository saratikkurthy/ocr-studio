# OCR Studio Phase 6E.2.1 — Collections Manager

## Included

- New top-level **Collections** navigation page
- Persistent collection registry per workspace
- Create, edit, and delete collection metadata
- Collection icon and accent color
- Languages, tags, institution, owner, and license metadata
- Assign and move projects between collections
- Unassigned-project inbox
- Automatic collection statistics calculated from existing project files
- Collection detail drawer
- Collection search
- Full collection ZIP export including assigned project folders

## New files

- `electron/collectionService.js`
- `src/pages/Collections/CollectionsPage.tsx`
- `src/pages/Collections/CollectionsPage.css`
- `src/types/Collection.ts`

## Updated files

- `electron/main.js`
- `electron/preload.cjs`
- `src/App.tsx`
- `src/layouts/MainLayout.tsx`
- `src/types/electron.d.ts`

## Storage

Collection data is stored inside each selected workspace:

```text
<workspace>/.ocr-studio/collections.json
<workspace>/.ocr-studio/collection-assignments.json
```

Deleting a collection never deletes its projects. Its projects return to the Unassigned Projects area.

## Run

```powershell
npm install
npm run dev
```

## Test checklist

1. Restart OCR Studio.
2. Open **Collections** from the left navigation.
3. Select a workspace containing existing projects.
4. Create a collection with name, languages, tags, icon, and color.
5. Assign an unassigned project to the collection.
6. Open the collection card and verify projects and statistics.
7. Edit the collection metadata.
8. Move a project to another collection or return it to Unassigned.
9. Click **Refresh statistics** after OCR/review changes.
10. Export the collection and verify the ZIP contains `collection.json` and the assigned project folders.
11. Restart OCR Studio and confirm collections and assignments persist.
12. Delete a collection and confirm its projects are not deleted.

## Validation completed

- `npm run build` passed
- `node --check electron/main.js` passed
- `node --check electron/preload.cjs` passed
- `node --check electron/collectionService.js` passed
