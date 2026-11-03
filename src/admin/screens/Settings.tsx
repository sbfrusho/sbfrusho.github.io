import { TextField, Toggle, useDraftValue } from "../components/Fields";
import { Card, PageHeader } from "../components/ui";
import { settingsSchema } from "../../lib/schema";

const SECTIONS = Object.keys(settingsSchema.shape.sections.shape);

function DescriptionCounter() {
  const value = useDraftValue<string>("settings.metaDescription") ?? "";
  const n = value.length;
  const tone = n > 160 ? "text-danger" : n >= 50 ? "text-accent" : "text-ink-2";
  return <span className={`font-mono text-xs ${tone}`} data-testid="meta-count">{n} / 160</span>;
}

export function Settings() {
  const description = useDraftValue<string>("settings.metaDescription") ?? "";
  const n = description.length;
  const hint = n > 160 ? "Longer than search results usually show, so it may be cut off." : n < 50 ? "A bit short. 50 to 160 characters works best in search results." : "A good length for search results.";
  return (
    <div>
      <PageHeader eyebrow="Site" title="Settings" description="What search engines see, and which sections appear on the site." />
      <div className="flex flex-col gap-4">
        <Card title="Search and sharing">
          <div className="flex flex-col gap-4">
            <TextField path="settings.siteTitle" label="Site title" required />
            <TextField path="settings.metaDescription" label="Meta description" required rows={3} hint={hint} counter={<DescriptionCounter />} />
          </div>
        </Card>
        <Card title="Section visibility" description="Hidden sections keep their content here. They just do not appear on the site.">
          <div className="grid gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
            {SECTIONS.map((s) => (
              <Toggle key={s} path={`settings.sections.${s}`} label={s.charAt(0).toUpperCase() + s.slice(1)} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
