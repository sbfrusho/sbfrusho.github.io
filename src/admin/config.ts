/** Fixed facts about the deployment target. The admin only ever talks to this one repository. */
export const OWNER = "sbfrusho";
export const REPO = "sbfrusho.github.io";
export const BRANCH = "main";
export const CONTENT_PATH = "src/data/content.json";
export const UPLOADS_DIR = "public/uploads";
export const RESUME_DIR = "public/resume";
export const LIVE_URL = "https://sbfrusho.github.io";
export const WORKFLOW_PATH = ".github/workflows/deploy.yml";
export const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
export const ACTIONS_URL = `${REPO_URL}/actions`;
export const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_PX = 900;
export const COVER_MAX_PX = 1600;

/** Same key and data-theme convention as the public site. */
export const THEME_KEY = "theme";
