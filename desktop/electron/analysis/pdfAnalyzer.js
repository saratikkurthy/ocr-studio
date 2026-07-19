import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const WSL_DISTRO = "Ubuntu-24.04";

function windowsPathToWslPath(windowsPath) {
  const normalized = path.resolve(windowsPath);

  const driveMatch = normalized.match(/^([A-Za-z]):[\\/](.*)$/);

  if (!driveMatch) {
    throw new Error(`Unsupported Windows path: ${windowsPath}`);
  }

  const driveLetter = driveMatch[1].toLowerCase();
  const remainingPath = driveMatch[2].replace(/\\/g, "/");

  return `/mnt/${driveLetter}/${remainingPath}`;
}

function runWslCommand(command, args = []) {
  return new Promise((resolve) => {
    const wslArgs = [
      "-d",
      WSL_DISTRO,
      "--",
      command,
      ...args,
    ];

    const child = spawn("wsl.exe", wslArgs, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;

      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: stderr || error.message,
      });
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;

      resolve({
        success: exitCode === 0,
        exitCode: exitCode ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

function parsePdfInfo(output) {
  const getValue = (label) => {
    const expression = new RegExp(`^${label}:\\s*(.+)$`, "mi");
    return output.match(expression)?.[1]?.trim();
  };

  const pageCountValue = Number(getValue("Pages"));

  return {
    title: getValue("Title") || "",
    author: getValue("Author") || "",
    creator: getValue("Creator") || "",
    producer: getValue("Producer") || "",
    pageCount: Number.isFinite(pageCountValue) ? pageCountValue : 0,
    pageSize: getValue("Page size") || "",
    pdfVersion: getValue("PDF version") || "",
    encrypted: getValue("Encrypted") || "unknown",
    tagged: getValue("Tagged") || "unknown",
  };
}

function countPdfImages(output) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.filter((line) => /^\d+\s+\d+\s+/.test(line)).length;
}

function calculateQuality({
  pageCount,
  imageCount,
  characterCount,
  searchable,
}) {
  if (pageCount === 0) {
    return {
      score: 0,
      label: "Unknown",
    };
  }

  if (searchable && characterCount > pageCount * 30) {
    return {
      score: 95,
      label: "Excellent",
    };
  }

  const imagesPerPage = imageCount / pageCount;

  if (imagesPerPage >= 0.8) {
    return {
      score: 80,
      label: "Good",
    };
  }

  if (imagesPerPage >= 0.4) {
    return {
      score: 65,
      label: "Fair",
    };
  }

  return {
    score: 45,
    label: "Poor",
  };
}

function createRecommendation({
  searchable,
  characterCount,
  pageCount,
  imageCount,
}) {
  if (searchable && characterCount > pageCount * 30) {
    return {
      action: "SKIP_OCR",
      label: "Already searchable",
      reason: "This PDF already contains a usable text layer.",
    };
  }

  if (imageCount === 0) {
    return {
      action: "REVIEW",
      label: "Manual review",
      reason:
        "No embedded page images or usable text layer were detected.",
    };
  }

  return {
    action: "RUN_OCR",
    label: "OCR recommended",
    reason:
      "This PDF appears to contain scanned pages without a usable text layer.",
  };
}

export async function analyzePdf(pdfPath) {
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error(`PDF file does not exist: ${pdfPath}`);
  }

  if (!pdfPath.toLowerCase().endsWith(".pdf")) {
    throw new Error("PDF analysis currently supports PDF files only.");
  }

  const fileStats = fs.statSync(pdfPath);
  const pdfWslPath = windowsPathToWslPath(pdfPath);

  const [pdfInfoResult, textResult, imagesResult] = await Promise.all([
    runWslCommand("pdfinfo", [pdfWslPath]),
    runWslCommand("pdftotext", [pdfWslPath, "-"]),
    runWslCommand("pdfimages", ["-list", pdfWslPath]),
  ]);

  if (!pdfInfoResult.success) {
    throw new Error(
      pdfInfoResult.stderr ||
        `pdfinfo failed for ${path.basename(pdfPath)}`
    );
  }

  const metadata = parsePdfInfo(pdfInfoResult.stdout);

  const extractedText = textResult.success
    ? textResult.stdout.trim()
    : "";

  const characterCount = extractedText.replace(/\s/g, "").length;
  const wordCount = extractedText
    ? extractedText.split(/\s+/).filter(Boolean).length
    : 0;

  const imageCount = imagesResult.success
    ? countPdfImages(imagesResult.stdout)
    : 0;

  const minimumUsefulCharacters = Math.max(
    20,
    metadata.pageCount * 10
  );

  const searchable = characterCount >= minimumUsefulCharacters;

  const quality = calculateQuality({
    pageCount: metadata.pageCount,
    imageCount,
    characterCount,
    searchable,
  });

  const recommendation = createRecommendation({
    searchable,
    characterCount,
    pageCount: metadata.pageCount,
    imageCount,
  });

  return {
    fileName: path.basename(pdfPath),
    filePath: pdfPath,
    fileSize: fileStats.size,

    pageCount: metadata.pageCount,
    pageSize: metadata.pageSize,
    pdfVersion: metadata.pdfVersion,
    encrypted: metadata.encrypted,
    tagged: metadata.tagged,

    title: metadata.title,
    author: metadata.author,
    creator: metadata.creator,
    producer: metadata.producer,

    searchable,
    characterCount,
    wordCount,
    sampleText: extractedText.slice(0, 500),

    imageCount,
    containsImages: imageCount > 0,
    estimatedDocumentType:
      imageCount >= metadata.pageCount * 0.75
        ? "Scanned document"
        : searchable
          ? "Digital document"
          : "Mixed or unknown",

    qualityScore: quality.score,
    qualityLabel: quality.label,

    recommendation: recommendation.action,
    recommendationLabel: recommendation.label,
    recommendationReason: recommendation.reason,

    analysisStatus: "Completed",
    analyzedAt: new Date().toISOString(),

    errors: {
      textAnalysis:
        textResult.success ? undefined : textResult.stderr,
      imageAnalysis:
        imagesResult.success ? undefined : imagesResult.stderr,
    },
  };
}