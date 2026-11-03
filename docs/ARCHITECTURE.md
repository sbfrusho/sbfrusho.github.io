# Architecture and agent contract

Astro 7 static site on GitHub Pages at https://sbfrusho.github.io. There is no server or database.

- **Content:** `src/data/content.json`, validated by `src/lib/schema.ts`. A schema error fails the build.
- **Uploads:** committed to `public/uploads/` (images) and `public/resume/` (PDFs), referenced as `/uploads/x.webp`.
- **Public site:** `src/pages/index.astro` + `src/components/site/*`. Static HTML with minimal JS.
- **Admin:** `src/pages/admin.astro` mounts a React app from `src/admin/*` with a bundled, same-origin module `<script>`. It deliberately does not use `client:only`, because that makes Astro emit inline scripts and styles, which the page's strict CSP blocks. The CSP applies to production builds only.
- **Saving:** the admin commits to `sbfrusho/sbfrusho.github.io` on `main` through the GitHub REST API, authenticated by a fine-grained token that only the owner has. The commit triggers `.github/workflows/deploy.yml`, and the site is live in about 1–2 minutes.
- **Design:** `src/styles/tokens.css` is shared by both surfaces.

## File ownership
| Area | Owner |
|---|---|
| `src/pages/index.astro`, `src/components/site/**`, `src/layouts/**`, `public/favicon*`, `src/pages/404.astro` | Site agent |
| `src/pages/admin.astro`, `src/admin/**` | Admin agent |
| `src/lib/schema.ts`, `src/data/content.json` | Shared. Do not change shape without recording it in `docs/agent-notes.md` |
| `src/styles/tokens.css` | Shared. Tune values and append tokens freely; never rename or remove |

## Rules
- All user-editable text comes from `content.json`. Never hardcode personal details in components.
- Render content as text. Never use `set:html` or `dangerouslySetInnerHTML`.
- Never run third-party scripts or analytics. The admin handles a GitHub token.
- Handoffs and requests between agents go in `docs/agent-notes.md`.
