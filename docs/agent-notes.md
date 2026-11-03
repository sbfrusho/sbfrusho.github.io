# Agent notes

## From Admin
- Admin page: `src/pages/admin.astro` + `src/admin/**`. Own HTML shell, does not use `layouts/Base.astro`.
- Theme: mirrors the site exactly. `localStorage["theme"]` (`light|dark`, absent = system), `<html data-theme>`, toggle order system → light → dark.
- Added one file outside my folders: `public/admin-theme.js`, a blocking theme script for `/admin` only. A strict CSP forbids the inline version. Please do not move it.
- CSP detail: `client:only` makes Astro emit inline `<script>`/`<style>`, which a strict CSP blocks. `admin.astro` mounts React from a bundled module `<script>` instead.
- Media screen treats a file in `public/uploads` or `public/resume` as "in use" only if `content.json` references it (`profile.photo`, `profile.resumes[].file`, `projects[].image`). Unused files can be deleted from the admin. So **do not hardcode references to those folders in site code**; put site-owned assets elsewhere in `public/`.
- No schema changes.

## From Site

**Status:** public site done (`src/pages/index.astro`, `src/pages/404.astro`, `src/layouts/Base.astro`, `src/components/site/**`, `public/favicon*`, `public/robots.txt`).

**Visual decisions the admin should mirror**
- Radius: `--r-1` 4px (tags), `--r-2` 8px (buttons, inputs), `--r-3` 14px (cards, images). Pills (`999px`) only for filter chips and the status badge.
- Primary button: `background: var(--accent); color: var(--accent-ink)`, min-height 46px, padding-inline about 1.1rem, weight 500, 15px, hover mixes 14% `--ink` into the accent. Secondary: 1px `--ink-3` border, `--ink` text, hover `--surface-2` fill. No shadows or gradients on buttons.
- Type: `font-display` (Bricolage, weight 600, slight negative tracking, about -0.015em) for headings, `font-sans` for body, `font-mono` at 12-13px only for small labels. Muted text is `--ink-2`.
- `--ink-3` is about 4.6:1 on `--bg` in light, so it passes for text but is tight on `--surface-2`. The site uses it only for decoration and borders. Use `--ink-2` for readable text.
- Rules: 1px `--line` between rows, 1px `--ink` for the strong rule above a list. Page gutter `clamp(1.25rem, 4.5vw, 4.5rem)`.
- Motif: corner-bracket "detection box" (`.det-box` in `src/components/site/site.css`), 2px accent. Used sparingly: portrait, research metric, 404.

**Shared changes**
- `tokens.css`: Bricolage import now uses `opsz.css` (opsz + wght axes, adds about 36 KB, family name unchanged). Appended `--r-1..3`, `--cover-*` (fallback covers, same in both themes), `--band-bg/--band-ink` (contact band). Nothing renamed or removed.
- `package.json`: added dev dependency `@types/node` (`src/components/site/assets.ts` reads `/public` at build time).
- Theme preference lives in `localStorage` key `theme` (`light` | `dark`, absent = system), applied as `<html data-theme>`. Same origin as the admin, so reusing the key keeps both surfaces in sync.
- `public/robots.txt` disallows `/admin`. The admin page should also carry `<meta name="robots" content="noindex">`, because robots.txt alone doesn't stop indexing of a linked URL.

**Behaviour the admin form can rely on**
- Project `image`, profile `photo` and résumé `file` are checked against `public/` at build time. A path whose file is missing falls back (generated cover, no photo, résumé link hidden) instead of failing the build, so upload the file in the same commit as the JSON.
- Project images of any aspect ratio work. Near 16:10 they fill the frame; very wide or tall ones are shown whole on a quiet backdrop.
- A project's `imageAlt` is used as written, so please prompt for it when an image is set.
- `availabilityText` shows only when `available` is true.

**Copy to confirm (owner, nothing changed)**
- The phone number in `content.json` is published on the public site and is easy to scrape. Empty the field to hide it.
- `companyUrl` `https://mymedicalhub.com` and the external links were not checked for reachability.

## From Admin (final)
- **Status:** admin done. `astro check` and `astro build` pass. No schema changes and no new dependencies.
- Mirrored from "From Site": radii, 46px buttons, `--ink-3` secondary border, `--ink-2` for readable text, mono eyebrows. `imageAlt` is prompted for when a cover is set.
- CSP has `font-src 'self' data:` because the build inlines the smallest `@fontsource` subsets into the shared stylesheet.
- If `admin.astro` ever stops loading, check first that nothing added an inline `<script>` or `<style>` to it. Any inline code there is blocked in production by design.

## Site review of Admin

Judged from the admin's screenshots and source, plus a scratch-copy build. Type, radii, buttons, spacing and tokens match the site well. Nothing here blocks release.

**Defects, most severe first**
1. **Medium. `src/admin/screens/Collections.tsx:155`: the description is wrong.** It says "The order here is the order on the site", but the site always shows featured projects first, then the rest. In the scratch build, a non-featured project moved to the top still rendered below the featured ones. Suggested text: "Featured projects show first. Within each group, the order here is the order on the site."
2. **Medium. `src/admin/components/ui.tsx:64`: disabled primary buttons look washed out.** `disabled:opacity-50` makes Sign in pale in light theme and dim in dark, and it's the main action on the first screen a visitor sees. Publish has the same look most of the time. Suggested fix: for disabled primary buttons, use a solid `bg-surface-2 text-ink-2` instead of opacity, or keep Sign in enabled and validate on submit.
3. **Low. `src/admin/screens/SignIn.tsx`: no site identity and no way back.** A visitor who lands here sees only a lowercase "admin panel" label. Suggested fix: replace it with the site's brand (the mark, `.brand-mark` in `src/components/site/site.css`, plus `shortName`) linking to `/`, and keep "Admin" as the small label.
4. **Low. `src/admin/screens/Profile.tsx:59`: the platform select shows raw enum values** (`github`, `linkedin`). `PLATFORM_LABEL` already holds display names. Suggested fix: add an optional label map to `SelectField` (`src/admin/components/Fields.tsx:82`) and pass it here.
5. **Low. `src/admin/components/Uploads.tsx:209`: the profile photo is saved as WebP, and that file becomes `og:image`.** Some link-preview crawlers may handle WebP poorly (not tested here). Suggested fix: save the profile photo as JPEG, since it's the site's only share image.
6. **Low. `src/admin/screens/SignIn.tsx:90`: the unchecked "Remember" checkbox is a grey filled box in dark theme** and reads as disabled. Suggested fix: use a custom checkbox with a `--surface` background and an `--ink-3` border.
7. **Low. `src/admin/screens/Collections.tsx:170`: at 360px the secondary action (Import from GitHub) stacks above the primary (Add project).** Suggested fix: put the primary first on phones.

**Shared CSS (not an admin code defect, no action needed now)**
- Tailwind scans `src/admin`, so admin utilities ship in the stylesheet the public site loads. `tokens.css` output is now 39 KB (about 10 KB gzipped). It causes no visual conflict. If it ever matters, split the utilities out with `@source not` and a separate admin entry.

**Fixed on the site side**
- The hero portrait is now square at every width. It was 4:5 on desktop, which would have cut the sides off the admin's square crop.
- Filter chips now follow schema order, so reordering projects no longer reshuffles them.
- An empty `photoAlt` now falls back to the person's name.

**Integration results (scratch copy; `content.json` untouched)**
- These all work on the site: `/uploads/<slug>-<random>.webp` as profile photo and project cover (dimensions read correctly), a 600x1300 phone-shaped cover (shown whole), a replaced résumé under a new name with the old file removed, a new project bringing back an absent category (chip and filter work), and reversed project order. No broken images, 4xx responses, page errors or overflow at 360 and 1440.
- Test files followed the `safeFileName` format but were created by hand. The real upload and commit flow wasn't run from the site side.

**Rules**
- `public/admin-theme.js` is referenced only by `/admin`. Neither `index.html` nor `404.html` mentions it or loads admin JS, and neither has a link to `/admin`.
- The admin's CSP and `noindex` apply only to its own page. `robots.txt` disallows `/admin`.
- All appended tokens are intact, and `src/admin` has no CSS files of its own.
- The publish bar appearing mid-page in the admin's full-page screenshots is a capture artifact of `position: sticky`, not a defect.

## Admin review of Site

Tested with a scratch copy on Node 22.23.4: six real admin publishes applied as trees, `npm run build` after each. The site rendered every change correctly and escaped hostile text.

**Defects, most severe first** (none block release; site code not edited)
1. **Low. `public/robots.txt`: `Disallow: /admin` hides the admin's `noindex` from crawlers.** A blocked crawler never fetches the page, so it can't read the tag, and an externally linked URL can still be listed without content. Nothing on the site links to `/admin`, and there's no sitemap, so the exposure is small. Suggested fix: remove the `Disallow` line and rely on `noindex`. The same prefix rule also matches `/admin-theme.js`, which is harmless.
2. **Low. Very long unbroken strings overflow the page.** With 60-200 character strings with no spaces in many fields at once, the page overflowed by 1929px at 360 wide and 894px at 1440. At 1440 the elements flagged include `.badge` (`availabilityText`) and `.hero-cta` (résumé label). I only inspected the first 8 of 110 flagged elements, so other fields may also be affected. Only pathological input triggers this. Suggested fix: add `overflow-wrap: anywhere` to `.badge` and the hero CTA labels, then retest with one long field at a time.

**Confirmed working**
- New project with cover, new photo (`src`, `og:image`), replaced résumé (identical bytes, old link gone), deleted unused file, hidden project (text and link absent), section off (section, nav and 404 nav absent).
- Hostile tagline and description are escaped.
- Schema-valid extremes build with no dead anchors, empty `src` or empty `href`: all lists empty, all sections off, every project hidden.
- `localStorage["theme"]` carries both ways between `/`, `/admin/` and 404 pages, through all three toggle states.

**Not owned by either agent: `.github/workflows/deploy.yml`.** See the coordinator report: `node-version: 22` can fail on Astro's version gate (`>=22.23.4`).

**Site review of Admin, all 7 items fixed:** ordering copy, solid disabled primary button, brand and link home on sign-in (name now comes from `content.json`, which also removes a hardcoded name), readable platform names, profile photo saved as JPEG, custom checkbox, primary action first on phones. New: a résumé with no file now blocks publish.
