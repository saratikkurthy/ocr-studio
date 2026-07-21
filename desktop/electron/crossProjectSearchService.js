import fs from "fs";
import path from "path";

function safeReadJson(filePath, fallback) {
  try {
    return fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
      : fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function readCollectionAssignments(workspacePath) {
  return safeReadJson(
    path.join(
      workspacePath,
      ".ocr-studio",
      "collection-assignments.json"
    ),
    { assignments: {} }
  );
}

function readCollections(workspacePath) {
  return safeReadJson(
    path.join(
      workspacePath,
      ".ocr-studio",
      "collections.json"
    ),
    { collections: [] }
  );
}

function buildContext(words, index, radius = 5) {
  return words
    .slice(
      Math.max(0, index - radius),
      Math.min(words.length, index + radius + 1)
    )
    .map((word) => ({
      id: word.id || null,
      text: word.correctedText || word.text || "",
      selected: word === words[index],
      confidence: Number(word.confidence || 0),
    }));
}

function matchesMode(word, mode) {
  const confidence = Number(word.confidence || 0);
  if (mode === "review") return confidence < 60;
  if (mode === "poor") return confidence < 35;
  if (mode === "unreviewed") {
    return !word.status || word.status === "Unreviewed";
  }
  if (mode === "corrected") {
    return Boolean(
      word.correctedText &&
      word.correctedText !== word.text
    );
  }
  return true;
}

function getProjectDocuments(projectPath) {
  const documents = safeReadJson(
    path.join(projectPath, "documents.json"),
    []
  );
  return Array.isArray(documents) ? documents : [];
}

function collectProjectSearch({
  project,
  query,
  mode,
  maxResults,
}) {
  const root = path.join(
    project.projectPath || "",
    "ocr-word-index"
  );
  const documents = getProjectDocuments(project.projectPath || "");
  const documentById = new Map(
    documents.map((document) => [
      Number(document.id),
      document,
    ])
  );
  const results = [];
  let scannedPages = 0;
  let scannedWords = 0;
  let totalMatches = 0;

  if (!fs.existsSync(root)) {
    return {
      results,
      scannedPages,
      scannedWords,
      totalMatches,
    };
  }

  const documentFolders = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
      })
    );

  for (const entry of documentFolders) {
    const documentId = Number(entry.name);
    if (!Number.isFinite(documentId)) continue;

    const folder = path.join(root, entry.name);
    const pageFiles = fs
      .readdirSync(folder)
      .filter((name) =>
        /^page-\d{6}\.json$/i.test(name)
      )
      .sort();

    for (const pageFile of pageFiles) {
      const page = safeReadJson(
        path.join(folder, pageFile),
        null
      );
      if (!page) continue;

      scannedPages += 1;
      const words = Array.isArray(page.words)
        ? page.words
        : [];
      scannedWords += words.length;

      for (let index = 0; index < words.length; index += 1) {
        const word = words[index];
        const effectiveText =
          word.correctedText || word.text || "";
        const normalized = normalizeText(effectiveText);

        if (query && !normalized.includes(query)) continue;
        if (!matchesMode(word, mode)) continue;

        totalMatches += 1;
        if (results.length >= maxResults) continue;

        const document = documentById.get(documentId);
        results.push({
          id: `${project.id}-${documentId}-${page.pageNumber}-${word.id || index}`,
          projectId: project.id,
          projectName: project.name,
          projectPath: project.projectPath,
          documentId,
          documentName:
            document?.fileName ||
            page.sourceFile ||
            page.fileName ||
            `Document ${documentId}`,
          pageNumber: Number(page.pageNumber || 0),
          wordId: word.id || null,
          text: effectiveText,
          originalText: word.text || "",
          correctedText: word.correctedText || null,
          confidence: Number(word.confidence || 0),
          status: word.status || "Unreviewed",
          language:
            page.language ||
            project.language ||
            "unknown",
          lineNumber: Number(word.lineNumber || 0),
          wordNumber: Number(word.wordNumber || 0),
          context: buildContext(words, index),
        });
      }
    }
  }

  return {
    results,
    scannedPages,
    scannedWords,
    totalMatches,
  };
}

export function registerCrossProjectSearchIpc(
  ipcMain,
  readRecentProjects
) {
  ipcMain.handle(
    "globalSearch:search",
    async (_event, data) => {
      const workspacePath = String(
        data?.workspacePath || ""
      );
      const collectionId = data?.collectionId
        ? String(data.collectionId)
        : null;
      const query = normalizeText(data?.query);
      const mode = [
        "all",
        "review",
        "poor",
        "unreviewed",
        "corrected",
      ].includes(data?.mode)
        ? data.mode
        : "all";
      const limit = Math.min(
        Math.max(Number(data?.limit) || 500, 1),
        5000
      );

      if (!workspacePath) {
        return {
          success: false,
          message: "Workspace path is required.",
          results: [],
          summary: {
            projects: 0,
            documents: 0,
            pages: 0,
            words: 0,
            matches: 0,
          },
          truncated: false,
        };
      }

      if (!query && mode === "all") {
        return {
          success: false,
          message:
            "Enter a search term or select a review filter.",
          results: [],
          summary: {
            projects: 0,
            documents: 0,
            pages: 0,
            words: 0,
            matches: 0,
          },
          truncated: false,
        };
      }

      const allProjects = readRecentProjects().filter(
        (project) =>
          project.workspacePath === workspacePath &&
          project.projectPath &&
          fs.existsSync(project.projectPath)
      );
      const assignments =
        readCollectionAssignments(workspacePath);
      const collections =
        readCollections(workspacePath);
      const collection = collectionId
        ? collections.collections.find(
            (item) => item.id === collectionId
          )
        : null;

      const projects = collectionId
        ? allProjects.filter(
            (project) =>
              assignments.assignments[
                String(project.id)
              ] === collectionId
          )
        : allProjects;

      const results = [];
      let scannedPages = 0;
      let scannedWords = 0;
      let totalMatches = 0;
      const matchedDocuments = new Set();
      const matchedProjects = new Set();

      for (const project of projects) {
        const remaining = Math.max(
          limit - results.length,
          0
        );
        const projectResult = collectProjectSearch({
          project,
          query,
          mode,
          maxResults: remaining,
        });

        scannedPages += projectResult.scannedPages;
        scannedWords += projectResult.scannedWords;
        totalMatches += projectResult.totalMatches;

        for (const result of projectResult.results) {
          results.push(result);
          matchedProjects.add(String(result.projectId));
          matchedDocuments.add(
            `${result.projectId}:${result.documentId}`
          );
        }
      }

      results.sort(
        (a, b) =>
          a.projectName.localeCompare(b.projectName) ||
          a.documentName.localeCompare(b.documentName) ||
          a.pageNumber - b.pageNumber ||
          a.lineNumber - b.lineNumber ||
          a.wordNumber - b.wordNumber
      );

      return {
        success: true,
        message:
          totalMatches === 0
            ? "No matching indexed words were found."
            : `${totalMatches} match(es) found across ${matchedProjects.size} project(s).`,
        scope: collection
          ? {
              type: "collection",
              id: collection.id,
              name: collection.name,
            }
          : {
              type: "workspace",
              id: null,
              name: "Entire workspace",
            },
        results,
        summary: {
          projects: projects.length,
          matchedProjects: matchedProjects.size,
          documents: matchedDocuments.size,
          pages: scannedPages,
          words: scannedWords,
          matches: totalMatches,
        },
        truncated: totalMatches > results.length,
      };
    }
  );

  ipcMain.handle(
    "globalSearch:export",
    async (_event, data) => {
      const workspacePath = String(
        data?.workspacePath || ""
      );
      const results = Array.isArray(data?.results)
        ? data.results
        : [];
      const query = String(data?.query || "").trim();

      if (!workspacePath) {
        return {
          success: false,
          message: "Workspace path is required.",
          filePath: null,
        };
      }

      const exportFolder = path.join(
        workspacePath,
        ".ocr-studio",
        "search-exports"
      );
      fs.mkdirSync(exportFolder, { recursive: true });

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
      const filePath = path.join(
        exportFolder,
        `cross-project-search-${stamp}.csv`
      );
      const escape = (value) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

      const lines = [
        [
          "Project",
          "Document",
          "Page",
          "Text",
          "Original Text",
          "Corrected Text",
          "Confidence",
          "Status",
          "Language",
          "Context",
        ]
          .map(escape)
          .join(","),
        ...results.map((result) =>
          [
            result.projectName,
            result.documentName,
            result.pageNumber,
            result.text,
            result.originalText,
            result.correctedText,
            result.confidence,
            result.status,
            result.language,
            Array.isArray(result.context)
              ? result.context
                  .map((item) => item.text)
                  .join(" ")
              : "",
          ]
            .map(escape)
            .join(",")
        ),
      ];

      fs.writeFileSync(filePath, lines.join("\n"), "utf-8");

      return {
        success: true,
        message: `${results.length} search result(s) exported for "${query}".`,
        filePath,
      };
    }
  );
}
