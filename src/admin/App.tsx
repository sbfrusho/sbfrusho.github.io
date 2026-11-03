import { useEffect } from "react";
import { ConfirmHost } from "./components/Dialog";
import { Shell } from "./components/Shell";
import { Toasts } from "./components/Toasts";
import { Card, PageHeader } from "./components/ui";
import { useRoute } from "./route";
import { Backup } from "./screens/Backup";
import { Achievements, EducationScreen, Experience, Projects, Research, Skills, Stats } from "./screens/Collections";
import { Dashboard } from "./screens/Dashboard";
import { History } from "./screens/History";
import { Media } from "./screens/Media";
import { Profile } from "./screens/Profile";
import { InvalidContent, LoadError, MissingContent } from "./screens/Recovery";
import { Settings } from "./screens/Settings";
import { BusyScreen, SignIn } from "./screens/SignIn";
import { boot, flushDraft, getState, selectDirty, useStore } from "./store";

const SCREENS: Record<string, () => React.ReactNode> = {
  dashboard: Dashboard,
  profile: Profile,
  projects: Projects,
  experience: Experience,
  research: Research,
  education: EducationScreen,
  skills: Skills,
  achievements: Achievements,
  stats: Stats,
  settings: Settings,
  media: Media,
  history: History,
  backup: Backup,
};

function Screens() {
  const { screen } = useRoute();
  const Current = SCREENS[screen];
  if (!Current) {
    return (
      <div>
        <PageHeader title="Page not found" />
        <Card><a className="text-sm underline" href="#/dashboard">Go to the dashboard</a></Card>
      </div>
    );
  }
  return <Current />;
}

export function App() {
  const phase = useStore((s) => s.phase);

  useEffect(() => {
    void boot();
    const guard = (e: BeforeUnloadEvent) => {
      flushDraft();
      if (selectDirty(getState())) e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      window.removeEventListener("beforeunload", guard);
      window.removeEventListener("pagehide", flushDraft);
    };
  }, []);

  let view: React.ReactNode;
  switch (phase) {
    case "boot":
      view = <BusyScreen label="Starting" />;
      break;
    case "signed-out":
    case "verifying":
      view = <SignIn />;
      break;
    case "loading":
      view = <BusyScreen label="Loading your content from GitHub" />;
      break;
    case "invalid":
      view = <InvalidContent />;
      break;
    case "missing":
      view = <MissingContent />;
      break;
    case "load-error":
      view = <LoadError />;
      break;
    default:
      view = <Shell><Screens /></Shell>;
  }
  return (
    <>
      {view}
      <ConfirmHost />
      <Toasts />
    </>
  );
}
