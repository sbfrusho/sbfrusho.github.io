import { useState, type SubmitEvent } from "react";
import { NEW_TOKEN_URL, OWNER, REPO } from "../config";
import { retrySavedToken, signIn, useStore } from "../store";
import { BrandMark, Button, ExtLink, Icon, Note, siteName, Spinner, ThemeToggle } from "../components/ui";

const STEP_CLASS = "flex gap-3 text-sm text-ink-2";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className={STEP_CLASS}>
      <span className="flex size-6 flex-none items-center justify-center rounded bg-surface-2 font-mono text-xs text-ink">{n}</span>
      <div className="min-w-0 pt-0.5">{children}</div>
    </li>
  );
}

function SetupGuide() {
  return (
    <ol className="flex flex-col gap-3" data-testid="setup-steps">
      <Step n={1}>Open <ExtLink href={NEW_TOKEN_URL}>New fine-grained token</ExtLink> on GitHub, and name it something like "Portfolio admin".</Step>
      <Step n={2}>Set an <strong className="font-medium text-ink">expiration</strong>. 90 days is a sensible choice. You can make a new one at any time.</Step>
      <Step n={3}>Under Repository access, choose <strong className="font-medium text-ink">Only select repositories</strong>, and pick only <code className="font-mono text-xs text-ink">{OWNER}/{REPO}</code>.</Step>
      <Step n={4}>
        Under Repository permissions, set:
        <ul className="mt-1.5 flex flex-col gap-1">
          <li className="flex items-center gap-2"><Icon name="check" size={14} className="text-accent" /><span><strong className="font-medium text-ink">Contents</strong>: Read and write</span></li>
          <li className="flex items-center gap-2"><Icon name="check" size={14} className="text-accent" /><span><strong className="font-medium text-ink">Actions</strong>: Read-only</span></li>
        </ul>
        <span className="mt-1.5 block">Leave everything else at "No access". GitHub adds Metadata: Read-only by itself.</span>
      </Step>
      <Step n={5}>Generate the token, copy it, and paste it here. GitHub shows it only once.</Step>
    </ol>
  );
}

export function SignIn() {
  const phase = useStore((s) => s.phase);
  const error = useStore((s) => s.signInError);
  const expired = useStore((s) => s.expired);
  const canRetry = useStore((s) => s.canRetrySavedToken);
  const hasDraftInMemory = useStore((s) => !!s.draft);
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const busy = phase === "verifying";
  const looksClassic = /^gh[pousr]_/.test(token.trim());

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token.trim() || busy) return;
    void signIn(token, remember);
  };

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl content-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
      <div>
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="flex min-h-11 min-w-0 items-center gap-2 rounded font-display text-base font-semibold tracking-tight text-ink hover:text-accent" title="Back to the site">
            <BrandMark />
            <span className="truncate">{siteName()}</span>
            <span className="font-mono text-xs font-normal text-ink-2">admin</span>
          </a>
          <ThemeToggle />
        </div>
        <h1 className="font-display text-4xl font-semibold leading-none tracking-tight text-ink sm:text-5xl">Sign in to manage your portfolio</h1>
        <p className="mt-3 text-sm text-ink-2">Edits are saved to GitHub from this browser. There is no server, and your token goes only to api.github.com.</p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" autoComplete="off">
          {expired && hasDraftInMemory && !error && <Note kind="info">Your unsaved work is still here. Sign in to continue.</Note>}
          {error && <Note kind="error"><span data-testid="signin-error">{error}</span></Note>}
          <div>
            <label htmlFor="token" className="mb-1.5 block text-sm font-medium text-ink">Fine-grained personal access token</label>
            <div className="relative">
              <input
                id="token"
                name="token"
                type={show ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="github_pat_..."
                className="block min-h-11 w-full rounded-lg border border-line bg-surface py-2 pl-3 pr-12 font-mono text-base text-ink placeholder:text-ink-3 sm:text-sm"
              />
              <button type="button" aria-label={show ? "Hide token" : "Show token"} aria-pressed={show} onClick={() => setShow(!show)} className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-lg text-ink-3 hover:text-ink cursor-pointer">
                <Icon name={show ? "eyeOff" : "eye"} />
              </button>
            </div>
            {looksClassic && <p className="mt-1 text-xs text-ink-2">This looks like a classic token, which reaches all your repositories. A fine-grained token limited to one repository is much safer.</p>}
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm">
            <span className="relative mt-0.5 size-5 flex-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer absolute inset-0 m-0 size-5 cursor-pointer appearance-none rounded border border-ink-3 bg-surface checked:border-accent checked:bg-accent" data-testid="remember" />
              <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-accent-ink peer-checked:flex"><Icon name="check" size={14} /></span>
            </span>
            <span>
              <span className="font-medium text-ink">Remember on this device</span>
              <span className="block text-xs text-ink-2">Otherwise the token is forgotten when this tab closes.</span>
            </span>
          </label>
          {remember && <Note kind="warning">The token will stay in this browser's storage until you sign out. Only tick this on a personal device nobody else uses.</Note>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" className="flex-1" busy={busy} disabled={!token.trim()} data-testid="signin-submit">
              {busy ? "Checking token" : "Sign in"}
            </Button>
            {canRetry && <Button onClick={() => void retrySavedToken()} busy={busy}>Retry saved token</Button>}
          </div>
        </form>
      </div>

      <div className="rounded-[var(--r-3)] border border-line bg-surface p-4 sm:p-6">
        <h2 className="mb-1 font-display text-xl font-semibold tracking-tight text-ink">First time here?</h2>
        <p className="mb-4 text-sm text-ink-2">Create a token that can only touch this one repository. It takes about a minute.</p>
        <SetupGuide />
      </div>
    </main>
  );
}

export function BusyScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center" role="status">
      <p className="flex items-center gap-3 text-sm text-ink-2"><Spinner size={18} /> {label}</p>
    </main>
  );
}
