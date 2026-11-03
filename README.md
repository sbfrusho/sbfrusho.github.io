# sbfrusho.github.io

Portfolio of Sakib Bin Faruque Rusho, built with Astro and hosted on GitHub Pages.

- **Site:** https://sbfrusho.github.io
- **Admin:** https://sbfrusho.github.io/admin/

## Editing content

Sign in to the admin with a GitHub token and publish your changes. Each publish is a commit to `main`, and the site updates about 1–2 minutes later.

Create the token at https://github.com/settings/personal-access-tokens/new:

1. Set an expiry date.
2. Under repository access, choose only `sbfrusho/sbfrusho.github.io`.
3. Set **Contents** to Read and write, and **Actions** to Read-only.

## Local development

Requires Node 22.23.4 or newer.

```bash
npm install
npm run dev
```

`npm run build` type-checks the project and builds it into `dist/`.

See `docs/ARCHITECTURE.md` for how the project is structured.
