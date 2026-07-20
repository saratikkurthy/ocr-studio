#!/usr/bin/env python3
"""Rebuild an invisible searchable PDF text layer from OCR Studio word-index data."""

from __future__ import annotations

import argparse
import html
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

try:
    import pikepdf
except Exception as exc:
    raise SystemExit(
        "Missing Python package 'pikepdf'. OCRmyPDF normally installs it. "
        f"Original error: {exc}"
    )

try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas
except Exception as exc:
    raise SystemExit(
        "Missing Python package 'reportlab'. Install it in Ubuntu with: "
        "python3 -m pip install --user reportlab. "
        f"Original error: {exc}"
    )


def find_font(preferred: list[str]) -> Path:
    candidates = [Path(item) for item in preferred if item]
    candidates.extend(
        Path(item)
        for item in [
            "/usr/share/fonts/truetype/noto/NotoSansTelugu-Regular.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansTelugu-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/mnt/c/Windows/Fonts/Nirmala.ttf",
            "/mnt/c/Windows/Fonts/mangal.ttf",
        ]
    )

    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate

    raise RuntimeError(
        "No suitable Unicode font was found. Install Noto fonts in Ubuntu "
        "(sudo apt install fonts-noto-core fonts-noto-extra) or provide a font path."
    )


def finite_number(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            return default
        return number
    except Exception:
        return default


def make_overlay_page(
    overlay_path: Path,
    page_width: float,
    page_height: float,
    indexed_page: dict[str, Any],
    font_name: str,
) -> int:
    image_width = max(finite_number(indexed_page.get("imageWidth")), 1.0)
    image_height = max(finite_number(indexed_page.get("imageHeight")), 1.0)
    sx = page_width / image_width
    sy = page_height / image_height

    pdf = canvas.Canvas(
        str(overlay_path),
        pagesize=(page_width, page_height),
        pageCompression=1,
    )

    written = 0
    for word in indexed_page.get("words", []):
        text = str(word.get("publishedText") or "").strip()
        if not text:
            continue

        box = word.get("box") or {}
        left = finite_number(box.get("left"))
        top = finite_number(box.get("top"))
        width = max(finite_number(box.get("width")), 0.1)
        height = max(finite_number(box.get("height")), 0.1)

        x = left * sx
        target_width = max(width * sx, 0.5)
        target_height = max(height * sy, 1.0)
        y = page_height - ((top + height) * sy)

        # Invisible text. Indic glyph shaping is not visually important here because
        # this layer is never painted; the embedded Unicode string powers search/copy.
        font_size = max(min(target_height * 0.90, 72.0), 3.0)
        natural_width = pdfmetrics.stringWidth(text, font_name, font_size)
        horizontal_scale = (
            max(min((target_width / natural_width) * 100.0, 500.0), 10.0)
            if natural_width > 0
            else 100.0
        )

        text_object = pdf.beginText()
        text_object.setTextOrigin(x, y)
        text_object.setFont(font_name, font_size)
        text_object.setTextRenderMode(3)
        text_object.setHorizScale(horizontal_scale)
        text_object.textOut(text)
        pdf.drawText(text_object)
        written += 1

    pdf.showPage()
    pdf.save()
    return written


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    base_pdf = Path(manifest["basePdf"])
    output_pdf = Path(manifest["outputPdf"])
    pages = manifest.get("pages", [])
    font_path = find_font(manifest.get("fontPaths", []))

    if not base_pdf.exists():
        raise RuntimeError(f"Base PDF does not exist: {base_pdf}")

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    font_name = "OCRStudioUnicode"
    pdfmetrics.registerFont(TTFont(font_name, str(font_path)))

    indexed_by_number = {
        int(page["pageNumber"]): page
        for page in pages
        if page.get("pageNumber") is not None
    }

    word_count = 0
    missing_index_pages: list[int] = []

    with tempfile.TemporaryDirectory(prefix="ocr-studio-publish-") as temp:
        temp_dir = Path(temp)

        with pikepdf.open(base_pdf) as base:
            for page_index, base_page in enumerate(base.pages, start=1):
                indexed_page = indexed_by_number.get(page_index)
                if not indexed_page:
                    missing_index_pages.append(page_index)
                    continue

                media_box = [float(value) for value in base_page.mediabox]
                page_width = media_box[2] - media_box[0]
                page_height = media_box[3] - media_box[1]
                overlay_path = temp_dir / f"overlay-{page_index:06d}.pdf"

                word_count += make_overlay_page(
                    overlay_path,
                    page_width,
                    page_height,
                    indexed_page,
                    font_name,
                )

                with pikepdf.open(overlay_path) as overlay:
                    destination = pikepdf.Rectangle(
                        media_box[0],
                        media_box[1],
                        media_box[2],
                        media_box[3],
                    )
                    base_page.add_overlay(overlay.pages[0], destination)

            base.save(
                output_pdf,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
            )

    result = {
        "success": True,
        "outputPdf": str(output_pdf),
        "fontPath": str(font_path),
        "pageCount": len(pages),
        "wordCount": word_count,
        "missingIndexPages": missing_index_pages,
        "outputSize": output_pdf.stat().st_size,
    }
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            json.dumps(
                {"success": False, "message": str(exc)},
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        raise SystemExit(1)
