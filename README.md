# mukundh0007.github.io

My personal portfolio, live at **https://mukundh0007.github.io**.

The design concept is "detected": the site behaves like a computer-vision model looking at me, with YOLO-style bounding boxes, class labels and confidence scores. It's plain HTML, CSS and a small vanilla-JS file. There's no build step, and GitHub Pages serves the `main` branch as is, so a push goes live in a minute or two.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | All the content: hero, About, case studies, more projects, strengths, timeline, contact |
| `assets/styles.css` | Design tokens (colours for light and dark), layout, detection boxes, animations |
| `assets/main.js` | Theme toggle, confidence count-ups, scroll reveal, diagram drawing, copy-email, the ⌘K / Ctrl+K palette. The page works without it |
| `404.html` | "No page detected" error page, same style |
| `assets/photo.jpg` | Hero photo (4:5) |
| `assets/Mukundh_Jayapal_Resume.pdf` | Resume, linked from the hero and Contact |
| `assets/og-image.png` | 1200×630 preview image for links shared on LinkedIn, Slack and other sites |
| `assets/favicon.svg` | Browser tab icon |
| `.nojekyll` | Tells GitHub Pages to serve the files as is |

## Common edits

**Text.** Everything is in `index.html`. Sections are marked with `<!-- ===== NAME ===== -->` comments.

**Hero detection boxes.** Each box is a `<span class="det" data-label="…" data-conf="…">`. Change `data-label` and `data-conf` to change what the label says. The box on the photo is positioned by `.det-face` in `styles.css` (left/top/width/height as percentages). Adjust it if you swap in a photo with different framing.

**Case studies.** Each is an `<article class="case">` with Problem / Approach / What was hard / Result cells. Cells lead with my own contribution; anything that comes from the paper or the wider team sits in a `<p class="context">` ("Paper context") note below it. The pipeline diagrams are inline SVG, with a wide version for desktop and a tall one for phones. Edit the text inside the `<text>` elements to relabel a step, and add `mine` to a step's `<g class="node">` (in both versions) to highlight it as my part.

**More projects.** Each project is an `<li class="proj">`. Copy one to add a project. The `<span class="det">` inside sets the hover label and score, and `style="--c: var(--c-cyan)"` picks its colour (`green`, `pink`, `cyan`, `orange`, `violet` or `red`).

**Strengths and timeline.** Each strength is an `<li class="strength">` with "Shown in" links to project or timeline anchors. Each timeline entry is an `<li class="tl">`, and its colour/class tag marks it as education, work, research or publication.

**Command palette.** Any element with a `data-cmd="Label"` attribute shows up in the palette. `data-cmd-group` sets the small tag on the right. Links and buttons are clicked, and anything else is scrolled to.

**Colours and fonts.** Tokens live at the top of `styles.css`: one light block and two identical dark blocks (system preference and manual toggle). Keep the two dark blocks in sync. Fonts are Bricolage Grotesque and JetBrains Mono from Google Fonts.

**Resume or photo.** Replace the file and keep the same name.

## Preview locally

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000 (and http://localhost:8000/nope to see the 404 page on GitHub Pages; the local server shows its own).

## Publishing

Commit and push to `main`. GitHub Pages deploys from the `main` branch, root folder (**Settings → Pages**).
