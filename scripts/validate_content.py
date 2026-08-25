#!/usr/bin/env python3
"""Validate synchronized website content without changing scientific data."""

from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable


WEBSITE_ROOT = Path(__file__).resolve().parents[1]


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(values["id"] or "")
        for name in ("href", "src"):
            if values.get(name):
                self.links.append(values[name] or "")


def read_json(relative: str) -> dict[str, Any]:
    path = WEBSITE_ROOT / relative
    return json.loads(path.read_text(encoding="utf-8"))


def iter_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from iter_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_strings(child)


def internal_asset_paths(paper: dict[str, Any], site: dict[str, Any], media: dict[str, Any]) -> set[str]:
    paths = {figure["path"] for figure in paper.get("figures", {}).values() if figure.get("path")}
    for value in site.get("links", {}).values():
        if isinstance(value, str) and not re.match(r"^[a-z]+://", value):
            paths.add(value)
    for key, value in media.items():
        records = value if isinstance(value, list) else ([value] if isinstance(value, dict) else [])
        for record in records:
            if record and record.get("src"):
                paths.add(record["src"])
    return paths


def check_public_path_leaks(errors: list[str]) -> None:
    pattern = re.compile(r"[A-Za-z]:\\Users\\[^\\\s]+", re.IGNORECASE)
    extensions = {".html", ".css", ".js", ".json", ".md", ".py"}
    for path in WEBSITE_ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in extensions:
            continue
        if path.name == "local.json" or ".git" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if pattern.search(text):
            errors.append(f"private absolute path appears in {path.relative_to(WEBSITE_ROOT)}")


def check_html_links(errors: list[str]) -> None:
    parser = LinkCollector()
    parser.feed((WEBSITE_ROOT / "index.html").read_text(encoding="utf-8"))
    script_ids = set(
        re.findall(
            r'id=["\']([^"\']+)["\']',
            (WEBSITE_ROOT / "static" / "js" / "site.js").read_text(encoding="utf-8"),
        )
    )
    for link in parser.links:
        if link.startswith("#") and link[1:] not in parser.ids | script_ids:
            errors.append(f"broken page anchor: {link}")
        elif link.startswith(("http://", "https://", "mailto:", "#")):
            continue
        elif not (WEBSITE_ROOT / link).exists():
            errors.append(f"broken internal HTML link: {link}")


def check_fact_registry(paper: dict[str, Any], errors: list[str]) -> None:
    facts = paper.get("facts", {})
    references = paper.get("headline_fact_ids", [])
    if len(references) != len(set(references)):
        errors.append("headline scientific fact references are duplicated")
    for fact_id in references:
        if fact_id not in facts:
            errors.append(f"headline references missing fact: {fact_id}")


def check_media_ids(media: dict[str, Any], errors: list[str]) -> None:
    identifiers: list[str] = []
    for value in media.values():
        if isinstance(value, list):
            identifiers.extend(item["id"] for item in value if isinstance(item, dict) and item.get("id"))
    duplicates = sorted({item for item in identifiers if identifiers.count(item) > 1})
    if duplicates:
        errors.append(f"duplicated media IDs: {', '.join(duplicates)}")


def check_ablation_charts(paper: dict[str, Any], errors: list[str]) -> None:
    views = paper.get("ablations", {}).get("views", [])
    for view in views:
        view_id = view.get("id", "unnamed")
        chart = view.get("chart", {})
        categories = chart.get("categories", [])
        series = chart.get("series", [])
        items = view.get("items", [])
        if chart.get("type") not in {"line", "bar"}:
            errors.append(f"ablation view {view_id} has an unsupported chart type")
        if not categories or len(categories) != len(items):
            errors.append(f"ablation view {view_id} categories do not match selectable items")
        if not series:
            errors.append(f"ablation view {view_id} has no chart series")
        for record in series:
            if not record.get("label") or not record.get("color"):
                errors.append(f"ablation view {view_id} has an incomplete series definition")
            values = record.get("values", [])
            if len(values) != len(categories) or not all(isinstance(value, (int, float)) for value in values):
                errors.append(f"ablation view {view_id} series {record.get('label', 'unnamed')} has invalid values")
        y_min = chart.get("y_min")
        y_max = chart.get("y_max")
        y_step = chart.get("y_step")
        if not all(isinstance(value, (int, float)) for value in (y_min, y_max, y_step)):
            errors.append(f"ablation view {view_id} has invalid y-axis settings")
        elif y_min >= y_max or y_step <= 0:
            errors.append(f"ablation view {view_id} has inconsistent y-axis settings")


def check_source_freshness(paper: dict[str, Any], paper_root: str | None, errors: list[str], notes: list[str]) -> None:
    if not paper_root:
        notes.append("manuscript freshness check skipped (no --paper-root supplied)")
        return
    sys.path.insert(0, str(WEBSITE_ROOT / "scripts"))
    import sync_paper  # pylint: disable=import-outside-toplevel

    root = Path(paper_root).expanduser().resolve()
    root_tex = sync_paper.find_root_tex(root)
    tex_files = sync_paper.collect_tex_tree(root_tex, root)
    current_digest = sync_paper.source_digest(tex_files, root)
    if current_digest != paper.get("source", {}).get("tex_digest_sha256"):
        errors.append("paper.generated.json is stale relative to the current manuscript source")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--paper-root", help="Optional external paper root for freshness checking.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    errors: list[str] = []
    notes: list[str] = []
    try:
        paper = read_json("data/paper.generated.json")
        site = read_json("config/site.json")
        media = read_json("data/media.json")
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1

    for relative in sorted(internal_asset_paths(paper, site, media)):
        if not (WEBSITE_ROOT / relative).is_file():
            errors.append(f"missing configured asset: {relative}")

    check_html_links(errors)
    check_public_path_leaks(errors)
    check_fact_registry(paper, errors)
    check_media_ids(media, errors)
    check_ablation_charts(paper, errors)
    check_source_freshness(paper, args.paper_root, errors, notes)

    if site.get("review_mode") is True:
        identifying_links = [site.get("links", {}).get(key) for key in ("code", "video", "arxiv")]
        if any(identifying_links):
            errors.append("review mode contains identifying external links")
        identity_values = list(iter_strings(site.get("public_identity", {})))
        if any(value.strip() for value in identity_values):
            errors.append("review mode contains public identity values")

    for key in ("hero_video", "introduction_video", "method_video"):
        if not media.get(key):
            notes.append(f"optional media not configured: {key}")
    if not media.get("real_robot_videos"):
        notes.append("optional media not configured: real_robot_videos")

    print("Content validation")
    for note in notes:
        print(f"- NOTE: {note}")
    if errors:
        for error in errors:
            print(f"- ERROR: {error}")
        return 1
    print("- OK: JSON data, internal links, configured assets, review mode, and identifiers")
    print("- OK: no private absolute Windows path found in public text files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
