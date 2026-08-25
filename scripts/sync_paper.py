#!/usr/bin/env python3
"""Synchronize CMAP manuscript metadata and selected assets into the website.

The manuscript repository is opened for reading only. All generated files are
written beneath the website workspace containing this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WEBSITE_ROOT = Path(__file__).resolve().parents[1]
CURATED_PATH = WEBSITE_ROOT / "data" / "paper.curated.json"
GENERATED_PATH = WEBSITE_ROOT / "data" / "paper.generated.json"
MANIFEST_PATH = WEBSITE_ROOT / "config" / "sync.manifest.json"
LOCAL_CONFIG_PATH = WEBSITE_ROOT / "config" / "local.json"


class SyncError(RuntimeError):
    """Raised when manuscript synchronization cannot be completed safely."""


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SyncError(f"Required configuration is missing: {path.relative_to(WEBSITE_ROOT)}") from exc
    except json.JSONDecodeError as exc:
        raise SyncError(f"Invalid JSON in {path.relative_to(WEBSITE_ROOT)}: {exc}") from exc


def resolve_paper_root(cli_value: str | None) -> Path:
    candidate = cli_value or os.environ.get("CMAP_PAPER_ROOT")
    if not candidate and LOCAL_CONFIG_PATH.exists():
        candidate = read_json(LOCAL_CONFIG_PATH).get("paperSourceRoot")
    if not candidate:
        raise SyncError(
            "Paper root is not configured. Use --paper-root, CMAP_PAPER_ROOT, "
            "or an ignored config/local.json file."
        )
    root = Path(candidate).expanduser().resolve()
    if not root.is_dir():
        raise SyncError("Configured paper root is not a directory.")
    return root


def strip_comments(tex: str) -> str:
    return re.sub(r"(?<!\\)%.*$", "", tex, flags=re.MULTILINE)


def extract_balanced(text: str, opening_brace: int) -> tuple[str, int]:
    if opening_brace >= len(text) or text[opening_brace] != "{":
        raise SyncError("Expected a braced LaTeX argument.")
    depth = 0
    for index in range(opening_brace, len(text)):
        character = text[index]
        if character == "{" and (index == 0 or text[index - 1] != "\\"):
            depth += 1
        elif character == "}" and (index == 0 or text[index - 1] != "\\"):
            depth -= 1
            if depth == 0:
                return text[opening_brace + 1 : index], index + 1
    raise SyncError("Unbalanced braces in LaTeX source.")


def command_argument(text: str, command: str, start: int = 0) -> str | None:
    match = re.search(rf"\\{re.escape(command)}\s*\{{", text[start:])
    if not match:
        return None
    opening = start + match.end() - 1
    value, _ = extract_balanced(text, opening)
    return value


def latex_to_text(value: str) -> str:
    text = value
    for command in ("textbf", "textit", "emph", "textrm", "texttt", "mbox", "shortstack"):
        pattern = re.compile(rf"\\{command}\s*\{{([^{{}}]*)\}}")
        while pattern.search(text):
            text = pattern.sub(r"\1", text)
    text = re.sub(r"\\(?:LARGE|Large|large|bf|it|rm|fullerpar)\b", "", text)
    text = re.sub(r"\\(?:citep|citet|cite|ref)\s*\{[^{}]*\}", "", text)
    text = re.sub(r"\\mathcal\s*\{([^{}]*)\}", r"\1", text)
    text = text.replace(r"\%", "%").replace(r"\&", "&").replace("~", " ")
    text = text.replace("$", "").replace("--", "-")
    text = re.sub(r"\\[A-Za-z@]+(?:\[[^\]]*\])?", "", text)
    text = text.replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", text).strip()


def find_root_tex(paper_root: Path, explicit_name: str | None = None) -> Path:
    if explicit_name:
        candidate = (paper_root / explicit_name).resolve()
        if candidate.parent != paper_root and paper_root not in candidate.parents:
            raise SyncError("Root TeX path escapes the paper repository.")
        if not candidate.is_file():
            raise SyncError("Requested root TeX file does not exist.")
        return candidate

    candidates: list[Path] = []
    for path in paper_root.rglob("*.tex"):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = path.read_text(encoding="utf-8-sig")
        if "\\begin{document}" in text and "CMAP:" in text:
            candidates.append(path)
    if not candidates:
        raise SyncError("No CMAP root manuscript with \\begin{document} was found.")
    candidates.sort(key=lambda path: (path.stat().st_mtime_ns, -len(path.parts)), reverse=True)
    return candidates[0]


def collect_tex_tree(root_tex: Path, paper_root: Path) -> list[Path]:
    ordered: list[Path] = []
    seen: set[Path] = set()

    def visit(path: Path) -> None:
        resolved = path.resolve()
        if resolved in seen:
            return
        if paper_root not in resolved.parents and resolved != paper_root:
            raise SyncError("A LaTeX input escapes the paper repository.")
        if not resolved.is_file():
            raise SyncError(f"Referenced LaTeX input is missing: {path.name}")
        seen.add(resolved)
        ordered.append(resolved)
        text = strip_comments(resolved.read_text(encoding="utf-8"))
        for match in re.finditer(r"\\(?:input|include)\s*\{([^{}]+)\}", text):
            relative = Path(match.group(1))
            if not relative.suffix:
                relative = relative.with_suffix(".tex")
            visit((resolved.parent / relative).resolve())

    visit(root_tex)
    return ordered


def source_digest(tex_files: list[Path], paper_root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(tex_files):
        digest.update(path.relative_to(paper_root).as_posix().encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def extract_caption(block: str) -> str | None:
    for pattern in (r"\\caption\s*\{", r"\\captionof\s*\{figure\}\s*\{"):
        match = re.search(pattern, block)
        if match:
            value, _ = extract_balanced(block, match.end() - 1)
            return latex_to_text(value)
    return None


def extract_figures(combined_tex: str) -> dict[str, str]:
    captions: dict[str, str] = {}
    for match in re.finditer(
        r"\\begin\{figure\*?\}(.*?)\\end\{figure\*?\}", combined_tex, flags=re.DOTALL
    ):
        block = match.group(1)
        for label_match in re.finditer(r"\\label\s*\{([^{}]+)\}", block):
            prefix = block[: label_match.start()]
            caption_starts = list(
                re.finditer(r"\\caption(?:of\s*\{figure\})?\s*\{", prefix)
            )
            if not caption_starts:
                continue
            caption_match = caption_starts[-1]
            raw_caption, _ = extract_balanced(prefix, caption_match.end() - 1)
            captions[label_match.group(1)] = latex_to_text(raw_caption)
    return captions


def find_compiled_pdf(root_tex: Path, paper_root: Path) -> Path:
    sibling = root_tex.with_suffix(".pdf")
    if sibling.is_file():
        return sibling
    candidates = [path for path in paper_root.rglob("*.pdf") if "figures" not in path.parts]
    if not candidates:
        raise SyncError("No compiled manuscript PDF was found.")
    return max(candidates, key=lambda path: path.stat().st_mtime_ns)


def find_bibliography(root_text: str, paper_root: Path) -> Path | None:
    match = re.search(r"\\bibliography\s*\{([^{}]+)\}", root_text)
    if not match:
        return None
    first_name = match.group(1).split(",")[0].strip()
    candidate = paper_root / first_name
    if not candidate.suffix:
        candidate = candidate.with_suffix(".bib")
    return candidate if candidate.is_file() else None


def safe_destination(relative_path: str) -> Path:
    destination = (WEBSITE_ROOT / Path(relative_path)).resolve()
    if WEBSITE_ROOT not in destination.parents:
        raise SyncError("Asset destination escapes the website workspace.")
    return destination


def copy_selected_assets(
    paper_root: Path, manifest: dict[str, Any], captions: dict[str, str]
) -> tuple[dict[str, Any], list[str]]:
    figures: dict[str, Any] = {}
    copied: list[str] = []
    for item in manifest.get("assets", []):
        source = (paper_root / Path(item["source"])).resolve()
        if paper_root not in source.parents:
            raise SyncError("Asset source escapes the paper repository.")
        if not source.is_file():
            raise SyncError(f"Required source asset is missing: {item['source']}")
        destination = safe_destination(item["destination"])
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(item["destination"])

        if item["kind"] == "figure":
            label = item.get("label")
            caption = captions.get(label or "")
            if not caption:
                raise SyncError(f"Figure caption not found for label: {label}")
            figures[item["key"]] = {
                "path": item["destination"].replace("\\", "/"),
                "alt": item["alt"],
                "caption": caption,
                "label": label,
            }
    return figures, copied


def build_paper_data(
    paper_root: Path, root_tex: Path, tex_files: list[Path], manifest: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    root_text = strip_comments(root_tex.read_text(encoding="utf-8"))
    combined = "\n".join(strip_comments(path.read_text(encoding="utf-8")) for path in tex_files)

    title_raw = command_argument(root_text, "title")
    abstract_match = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", root_text, re.DOTALL)
    keywords_match = re.search(r"\\begin\{keywords\}(.*?)\\end\{keywords\}", root_text, re.DOTALL)
    if not title_raw or not abstract_match or not keywords_match:
        raise SyncError("Title, abstract, or keywords could not be extracted from the root manuscript.")

    captions = extract_figures(combined)
    figures, copied = copy_selected_assets(paper_root, manifest, captions)
    bibliography = find_bibliography(root_text, paper_root)
    pdf = find_compiled_pdf(root_tex, paper_root)

    data = deepcopy(read_json(CURATED_PATH))
    data.update(
        {
            "title": latex_to_text(title_raw),
            "abstract": latex_to_text(abstract_match.group(1)),
            "keywords": [
                item.strip() for item in latex_to_text(keywords_match.group(1)).split(",") if item.strip()
            ],
            "sections": [latex_to_text(value) for value in re.findall(r"\\section\s*\{([^{}]+)\}", root_text)],
            "figures": figures,
            "source": {
                "root_tex": root_tex.relative_to(paper_root).as_posix(),
                "compiled_pdf": pdf.relative_to(paper_root).as_posix(),
                "bibliography": bibliography.relative_to(paper_root).as_posix() if bibliography else None,
                "tex_digest_sha256": source_digest(tex_files, paper_root),
                "generated_date": datetime.now(timezone.utc).date().isoformat(),
            },
        }
    )
    return data, copied


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--paper-root", help="Path to the external manuscript repository.")
    parser.add_argument("--root-tex", help="Optional root TeX path relative to the paper repository.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        paper_root = resolve_paper_root(args.paper_root)
        root_tex = find_root_tex(paper_root, args.root_tex)
        tex_files = collect_tex_tree(root_tex, paper_root)
        manifest = read_json(MANIFEST_PATH)
        data, copied = build_paper_data(paper_root, root_tex, tex_files, manifest)
        GENERATED_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except SyncError as exc:
        print(f"Synchronization failed: {exc}", file=sys.stderr)
        return 1

    print("Paper repository:")
    print("- external repository detected (read only)")
    print("Identified:")
    print(f"- root manuscript: {data['source']['root_tex']}")
    print(f"- compiled PDF: {data['source']['compiled_pdf']}")
    print(f"- bibliography: {data['source']['bibliography'] or 'not detected'}")
    print("Updated:")
    print("- title, abstract, keywords, section names, and figure captions")
    print(f"- {len(copied)} selected website assets")
    print("Manual review required:")
    print("- experimental aggregate values in data/paper.curated.json")
    print("- publication metadata and BibTeX")
    print("- future introduction and real-robot videos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
