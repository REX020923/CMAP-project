# CMAP project website

This repository is the presentation layer for **CMAP: Continuous Masked Action-Tape Modeling for Visuomotor Manipulation**. The manuscript repository remains external and read only. The website consumes synchronized metadata, captions, selected figures, the current anonymous manuscript PDF, and selected rollout videos.

## Preview locally

From the website directory, start a static web server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly is not supported because the page loads JSON data with `fetch()`.

## Connect the external manuscript

Pass the manuscript repository explicitly:

```powershell
python scripts/sync_paper.py --paper-root "C:\path\to\paper"
```

Or configure it for the current shell:

```powershell
$env:CMAP_PAPER_ROOT="C:\path\to\paper"
python scripts/sync_paper.py
```

A third option is to copy `config/local.example.json` to `config/local.json` and set `paperSourceRoot`. `config/local.json` is ignored by Git and must remain local.

The script locates the CMAP root TeX file, follows local `\input`/`\include` relationships, extracts the title, Abstract, keywords, section names, and figure captions, then copies only the files listed in `config/sync.manifest.json`. It never writes to the manuscript repository.

## Update after a manuscript revision

1. Edit and recompile the paper in its own repository.
2. Run `scripts/sync_paper.py` from this website repository.
3. Validate the synchronized site:

   ```powershell
   python scripts/validate_content.py --paper-root "C:\path\to\paper"
   ```

4. Review changes in `data/paper.generated.json` and visually check the site.
5. If a complex experimental table changed, update the single curated source at `data/paper.curated.json`, then synchronize again.

## Content architecture

- `data/paper.generated.json` is the browser-facing content bundle.
- `data/paper.curated.json` contains experiment structures that are intentionally not parsed from complex LaTeX tables.
- `config/sync.manifest.json` maps selected external assets to public website paths.
- `data/media.json` is the single media manifest.
- `config/site.json` controls anonymous/public identity and outbound links.
- `static/js/site.js` renders reusable sections and contains no scientific result table definitions.

## Add videos

Keep every public website video in `assets/videos/`. Use lowercase ASCII filenames separated with hyphens (for example, `cmap-paper-overview.mp4`); H.264 MP4 is the most broadly compatible delivery format.

Register each file once in `data/media.json`, according to where it should appear:

- `introduction_video`: the main paper/overview video shown near the abstract.
- `hero_video`: an optional featured video in the title area.
- `method_video`: a method walkthrough below the interactive CMAP figure.
- `simulation_videos`: one or more simulation task clips.
- `real_robot_videos`: one or more physical-robot clips.
- `success_failure_videos`: qualitative success/failure clips.

For a main paper video, copy the file to `assets/videos/`, then replace `introduction_video: null` in `data/media.json` with:

```json
{
  "id": "introduction",
  "group": "Overview",
  "title": "CMAP introduction",
  "src": "assets/videos/cmap-introduction.mp4"
}
```

The page hides unconfigured media cleanly. Each entry may also define `type` and `note` fields, which are rendered as provenance-aware card metadata. Simulation media can be filtered by benchmark, and only one video plays at a time. No JavaScript edit is needed when a video is added through the manifest.

The current simulation gallery contains twelve videos: the eight RoboTwin paper tasks, one additional Handover Mic rollout, and three ManiSkill tasks. The real-robot gallery contains AGIBOT G1 CMAP executions plus a clearly labeled Leju Kuavo 4 Pro expert demonstration. Supplemental videos copied directly into `assets/videos/` are not overwritten by manuscript synchronization; only files listed in `config/sync.manifest.json` are refreshed from the read-only manuscript repository.

The three AGIBOT G1 display clips use a consistent `640 × 380` crop that removes the top 100 pixels above the white divider. The Leju demonstration keeps its original framing.

## Interactive method figure

The CMAP method explorer is driven by `method.stages` in `data/paper.curated.json`. Each stage defines a `panel` label and a percentage-based `focus` rectangle (`left`, `top`, `width`, `height`). Editing those values updates the highlighted region without changing the manuscript figure itself. The stage controls support mouse, touch, and arrow-key navigation.

The Ablations section is driven by `ablations.views`. Each view supplies chart-ready series, selectable metrics, and explanations. The component view is drawn as an animated Canvas line chart, while the task view is drawn as an animated grouped bar chart. Selecting a numbered control or clicking a chart category updates the highlight and exact metrics; the play/pause control steps through the sequence automatically. Values remain centralized in `data/paper.curated.json`, and reduced-motion preferences are respected.

## REVIEW_MODE

`config/site.json` defaults to `"review_mode": true`. In review mode the site shows “Anonymous Authors” and hides author names, affiliations, acknowledgments, BibTeX, code, video, arXiv, and identifying external links.

After acceptance, set `review_mode` to `false`, fill `public_identity`, and configure only verified publication links. Do not invent DOI, venue, or arXiv metadata.

## GitHub Pages

The site is dependency free and deploys directly from the repository root. The included `.nojekyll` marker tells GitHub Pages to publish the static files without a Jekyll build.

For the first publication, create an empty GitHub repository and run the following commands from this website directory, replacing the remote URL with your own repository:

```powershell
git init
git add .
git commit -m "Publish CMAP project website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Then open the repository on GitHub and choose **Settings → Pages → Build and deployment → Deploy from a branch**. Select `main` and `/ (root)`, then save. A project repository is normally published at `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. A repository named exactly `YOUR-USERNAME.github.io` is published at the account root instead.

For later website updates, commit and push the changed files:

```powershell
git add .
git commit -m "Update project website"
git push
```

Keep `config/local.json` and `.env` untracked. Before publishing, confirm that `config/site.json` has the intended review mode and that every configured video is suitable for public release.
