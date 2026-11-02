# mukundh0007.github.io

My personal portfolio, live at **https://mukundh0007.github.io**.

It's a single static page: plain HTML and CSS, a few lines of JavaScript, and no build step. GitHub Pages serves the `main` branch as is, so any change you push goes live in a minute or two.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | All the content: hero, About, Projects, Skills, Contact, footer |
| `assets/styles.css` | Layout and styles. Colours are variables at the top, with a light set and a dark set |
| `assets/main.js` | Light/dark toggle and the footer year (the page works without it) |
| `assets/favicon.svg` | Browser tab icon |
| `.nojekyll` | Tells GitHub Pages to serve the files as is |

## Common edits

**Fill in the placeholders.** Search `index.html` for `Add your`. Each placeholder shows up on the page as a dashed yellow box, and the comment above it has the exact snippet to paste in:

- **Photo:** add `assets/photo.jpg` and swap the placeholder `<div>` in the hero for the `<img>` in the comment.
- **Email:** swap the placeholder `<span>` in Contact for the `mailto:` link in the comment.
- **Resume:** add `assets/resume.pdf` and swap the placeholder `<span>` in Contact for the link in the comment.
- **About:** replace the placeholder paragraph with your current focus and the roles you're looking for.

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
