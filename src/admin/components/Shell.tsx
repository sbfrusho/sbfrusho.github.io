/** App frame: sidebar or drawer, persistent publish bar and the screen outlet. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LIVE_URL } from "../config";
import type { AreaKey } from "../lib/content";
import { useRoute } from "../route";
import { confirmDialog, discardChanges, selectChangeCount, selectChangedAreas, selectDirty, signOut, toast, useStore } from "../store";
import { PublishDialog } from "./PublishDialog";
import { ConflictDialog, RestoreDialog } from "./SessionDialogs";
import { BrandMark, Button, Icon, IconButton, Note, siteName, ThemeToggle } from "./ui";

const NAV: { group: string; items: { key: string; label: string; icon: string; area?: AreaKey }[] }[] = [
  { group: "", items: [{ key: "dashboard", label: "Dashboard", icon: "dashboard" }] },
  {
    group: "Content",
    items: [
      { key: "profile", label: "Profile", icon: "profile", area: "profile" },
      { key: "projects", label: "Projects", icon: "projects", area: "projects" },
      { key: "experience", label: "Experience", icon: "experience", area: "experience" },
      { key: "research", label: "Research", icon: "research", area: "research" },
      { key: "education", label: "Education", icon: "education", area: "education" },
      { key: "skills", label: "Skills", icon: "skills", area: "skills" },
      { key: "achievements", label: "Achievements", icon: "achievements", area: "achievements" },
      { key: "stats", label: "Stats", icon: "stats", area: "stats" },
    ],
  },
  {
    group: "Site",
    items: [
      { key: "settings", label: "Settings", icon: "settings", area: "settings" },
      { key: "media", label: "Media", icon: "media" },
      { key: "history", label: "History", icon: "history" },
      { key: "backup", label: "Backup", icon: "backup" },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { screen } = useRoute();
  const changed = useStore(selectChangedAreas);
  const mediaChanged = useStore((s) => s.deletions.length > 0);
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-4">
      {NAV.map((g) => (
        <div key={g.group || "top"}>
          {g.group && <p className="mb-1 px-3 font-mono text-xs tracking-wide text-ink-2">{g.group}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = screen === item.key;
              const dirty = (item.area && changed.includes(item.area)) || (item.key === "media" && mediaChanged);
              return (
                <li key={item.key}>
                  <a
                    href={`#/${item.key}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors lg:min-h-10 ${active ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
                  >
                    <Icon name={item.icon} className={active ? "text-accent" : "text-ink-3"} />
                    <span className="flex-1">{item.label}</span>
                    {dirty && (
                      <>
                        <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                        <span className="sr-only">(unpublished changes)</span>
                      </>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const user = useStore((s) => s.user);
  const dirty = useStore(selectDirty);
  const handleSignOut = async () => {
    const ok = await confirmDialog({
      title: "Sign out?",
      body: dirty
        ? "Your token is cleared from this device. Your unpublished draft stays saved here, and you will be offered it when you sign in again."
        : "Your token is cleared from this device.",
      confirmLabel: "Sign out",
    });
    if (ok) signOut();
  };
  return (
    <div className="flex items-center gap-1 border-t border-line pt-2">
      <div className="min-w-0 flex-1 px-2">
        <p className="text-xs text-ink-2">Signed in as</p>
        <p className="truncate font-mono text-xs text-ink" title={user?.name}>{user?.login}</p>
      </div>
      <ThemeToggle />
      <IconButton label="Sign out" icon="logout" onClick={handleSignOut} data-testid="sign-out" />
    </div>
  );
}

function Brand() {
  const name = useStore((s) => s.draft?.profile.shortName) || siteName();
  return (
    <a href={LIVE_URL} target="_blank" rel="noopener noreferrer" className="group block rounded px-3" title="Open the live site">
      <span className="flex items-center gap-2 font-display text-lg font-semibold leading-tight tracking-tight text-ink group-hover:text-accent"><BrandMark /><span className="truncate">{name}</span></span>
      <span className="block font-mono text-xs tracking-wide text-ink-2">admin panel</span>
    </a>
  );
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 h-dvh max-h-none w-[min(19rem,85vw)] max-w-none border-r border-line bg-surface p-0 text-ink backdrop:bg-[color-mix(in_oklab,var(--ink)_40%,transparent)] lg:hidden"
    >
      {open && <div className="flex h-full flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <Brand />
          <IconButton label="Close navigation" icon="close" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto"><NavLinks onNavigate={onClose} /></div>
        <SidebarFooter />
      </div>}
    </dialog>
  );
}

function PublishBar({ onPublish }: { onPublish: () => void }) {
  const count = useStore(selectChangeCount);
  const savedAt = useStore((s) => s.savedAt);
  const handleDiscard = async () => {
    const ok = await confirmDialog({
      title: "Discard all changes?",
      body: "Every unpublished edit, staged upload and pending file removal in this draft will be lost. The live site is not affected.",
      confirmLabel: "Discard changes",
      danger: true,
    });
    if (ok) {
      discardChanges();
      toast("info", "Draft discarded.");
    }
  };
  return (
    <div className="sticky bottom-0 z-20 border-t border-line bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] backdrop-blur" data-testid="publish-bar">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6">
        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          {count > 0 ? (
            <>
              <span className="flex items-center gap-2 font-medium text-ink">
                <span className="size-2 flex-none rounded-full bg-accent" aria-hidden="true" />
                <span data-testid="change-count">{count} {count === 1 ? "area" : "areas"} changed</span>
              </span>
              <span className="block truncate pl-4 text-xs text-ink-2">
                {savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Saving draft"}
              </span>
            </>
          ) : (
            <span className="text-ink-2">Everything is published</span>
          )}
        </p>
        {count > 0 && (
          <>
            <IconButton className="sm:hidden" label="Discard changes" icon="undo" onClick={handleDiscard} />
            <span className="hidden sm:inline"><Button variant="ghost" onClick={handleDiscard} data-testid="discard">Discard</Button></span>
          </>
        )}
        <Button variant="primary" icon="upload" disabled={count === 0} onClick={onPublish} data-testid="publish-open">Publish</Button>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const warning = useStore((s) => s.storageWarning);
  const headerName = useStore((s) => s.draft?.profile.shortName) || siteName();
  const { screen, param } = useRoute();
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    // New screen: start at the top and move focus to its heading for keyboard and screen-reader users.
    main.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>("[data-page-title]")?.focus({ preventScroll: true });
  }, [screen]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [param]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-r border-line bg-surface p-3 lg:flex">
        <div className="pt-1"><Brand /></div>
        <div className="min-h-0 flex-1 overflow-y-auto"><NavLinks /></div>
        <SidebarFooter />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] px-1.5 py-1 backdrop-blur lg:hidden">
          <IconButton label="Open navigation" icon="menu" onClick={() => setDrawer(true)} data-testid="open-drawer" />
          <p className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-semibold tracking-tight"><BrandMark /><span className="truncate">{headerName}</span> <span className="font-mono text-xs font-normal text-ink-2">admin</span></p>
          <ThemeToggle />
        </header>
        <Drawer open={drawer} onClose={() => setDrawer(false)} />

        <main ref={main} className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
          {warning && <Note kind="warning" className="mb-4">{warning}</Note>}
          {children}
        </main>
        <PublishBar onPublish={() => setPublishOpen(true)} />
      </div>

      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
      <ConflictDialog />
      <RestoreDialog />
    </div>
  );
}

