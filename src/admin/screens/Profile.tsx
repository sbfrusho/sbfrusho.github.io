import { FormGrid, RowList, SelectField, StringList, TextField, Toggle } from "../components/Fields";
import { Card, PageHeader } from "../components/ui";
import { PdfField, PhotoField } from "../components/Uploads";
import { getAt, setAt, useStore } from "../store";
import { socialSchema, type Profile as P } from "../../lib/schema";

const PLATFORMS = socialSchema.shape.platform.options;
const PLATFORM_LABEL: Record<string, string> = {
  github: "GitHub", linkedin: "LinkedIn", email: "Email", x: "X", facebook: "Facebook", youtube: "YouTube", website: "Website", codeforces: "Codeforces", leetcode: "LeetCode", other: "Other",
};

export function Profile() {
  const available = useStore((s) => s.draft?.profile.available);
  return (
    <div>
      <PageHeader eyebrow="Content" title="Profile" description="Who you are, how to reach you, and the files people can download." />
      <div className="flex flex-col gap-4">
        <Card title="Identity">
          <div className="flex flex-col gap-4">
            <PhotoField path="profile.photo" />
            <TextField path="profile.photoAlt" label="Photo description" hint="Read aloud by screen readers. Describe the photo." />
            <FormGrid>
              <TextField path="profile.name" label="Full name" required />
              <TextField path="profile.shortName" label="Short name" required hint="Used in the site header." />
            </FormGrid>
          </div>
        </Card>
        <Card title="Introduction">
          <div className="flex flex-col gap-4">
            <TextField path="profile.headline" label="Headline" required rows={2} />
            <TextField path="profile.tagline" label="Tagline" required rows={3} />
            <StringList path="profile.roles" label="Roles" description="Short labels shown near the headline." addLabel="Add role" itemName="Role" />
            <StringList path="profile.about" label="About" description="Each entry is one paragraph." addLabel="Add paragraph" itemName="Paragraph" rows={4} />
          </div>
        </Card>
        <Card title="Contact">
          <FormGrid>
            <TextField path="profile.email" label="Email" type="email" required />
            <TextField path="profile.phone" label="Phone" type="tel" hint="Leave empty to hide it on the site." />
            <TextField path="profile.location" label="Location" />
          </FormGrid>
        </Card>
        <Card title="Availability">
          <Toggle path="profile.available" label="Open to work" hint="Shows your availability text on the site." />
          <div className="mt-3"><TextField path="profile.availabilityText" label="Availability text" disabled={!available} /></div>
        </Card>
        <Card title="Social links">
          <RowList<P["socials"][number]>
            path="profile.socials"
            make={() => ({ platform: "website", label: "", url: "" })}
            addLabel="Add link"
            itemName="Link"
            labelOf={(s) => s.label}
            empty="No social links yet."
          >
            {(p) => (
              <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,2fr)]">
                <SelectField
                  path={`${p}.platform`}
                  label="Platform"
                  options={PLATFORMS}
                  labels={PLATFORM_LABEL}
                  onChanged={(value) => {
                    if (!getAt(`${p}.label`)) setAt(`${p}.label`, PLATFORM_LABEL[value] ?? "");
                  }}
                />
                <TextField path={`${p}.label`} label="Label" required />
                <TextField path={`${p}.url`} label="URL" required type="url" placeholder="https://" />
              </div>
            )}
          </RowList>
        </Card>
        <Card title="Résumés" description="Replaced files stay in the repository until you remove them on the Media screen.">
          <ResumeList />
        </Card>
      </div>
    </div>
  );
}

function ResumeList() {
  return (
    <RowList<P["resumes"][number]>
      path="profile.resumes"
      make={() => ({ label: "", file: "" })}
      addLabel="Add résumé"
      itemName="Résumé"
      labelOf={(r) => r.label}
      empty="No résumés yet."
    >
      {(p, _i, item) => (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField path={`${p}.label`} label="Label" required placeholder="Software Engineer résumé" />
          <PdfField path={`${p}.file`} baseName={item.label || "resume"} />
        </div>
      )}
    </RowList>
  );
}

