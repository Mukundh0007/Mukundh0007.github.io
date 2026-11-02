# mukundh0007.github.io

My personal portfolio, live at **https://mukundh0007.github.io**.

It's a single static page: plain HTML and CSS, a few lines of JavaScript, and no build step. GitHub Pages serves the `main` branch as is, so any change you push goes live in a minute or two.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | All the content: hero, About, Projects, Skills, Contact, footer |
| `assets/styles.css` | Layout and styles. Colours are variables at the top, with a light set and a dark set |
| `assets/main.js` | Light/dark toggle and the footer year (the page works without it) |
| `assets/photo.jpg` | Profile photo in the hero |
| `assets/Mukundh_Jayapal_Resume.pdf` | Resume, linked from the hero and Contact |
| `assets/favicon.svg` | Browser tab icon |
| `.nojekyll` | Tells GitHub Pages to serve the files as is |

## Common edits

**Update the resume.** Replace `assets/Mukundh_Jayapal_Resume.pdf` with the new PDF, keeping the same file name. The hero button and the Contact link both point to it.

**Change the photo.** Replace `assets/photo.jpg` with a square image (about 560×560px). The page shows it as a circle.

**Change what you're looking for.** Edit the "Open to…" pill at the top of the hero and the "What I'm looking for" paragraph in About.

**Add a project.** In the Projects section, copy one `<li>…</li>` block (it holds an `<article class="card">`), then change the repo name, title, description, tags and link. Delete a block to remove a project. Cards for forks also have a `card-origin` line that credits the original repo.

**Change skills.** Edit the `<li>` items in the Skills section. Each group is a `skill-group` block.

**Change colours.** Edit the variables at the top of `assets/styles.css`. `--accent` is the main highlight colour. Update both the light block (`:root`) and the two dark blocks so the themes stay in sync.

## Preview locally

Open `index.html` in a browser, or run a local server from this folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Publishing

Commit and push to `main`. GitHub Pages is set to deploy from the `main` branch, root folder (**Settings → Pages**).
