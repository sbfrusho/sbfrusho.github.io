/**
 * The single source of truth for all editable site content.
 * Used by the public site at build time and by the admin panel before every save.
 * Change this file only with matching changes to BOTH consumers.
 */
import { z } from "zod";

/** Absolute http(s)/mailto/tel link. Blocks javascript: and data: URLs. */
export const safeUrl = z
  .string()
  .trim()
  .regex(/^(https?:\/\/|mailto:|tel:)\S+$/i, "Must start with https://, http://, mailto: or tel:");

/** Path to a file committed in /public, e.g. /uploads/foo.webp. Empty = none. */
export const assetPath = z
  .string()
  .regex(/^(\/(uploads|resume)\/[A-Za-z0-9._-]+)?$/, "Must be a file in /uploads or /resume");

export const linkSchema = z.object({ label: z.string().min(1), url: safeUrl });

export const socialSchema = z.object({
  platform: z.enum(["github", "linkedin", "email", "x", "facebook", "youtube", "website", "codeforces", "leetcode", "other"]),
  label: z.string().min(1),
  url: safeUrl,
});

export const profileSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
  headline: z.string().min(1),
  /** Short, rotating/stacked role labels shown near the hero. */
  roles: z.array(z.string().min(1)),
  tagline: z.string().min(1),
  /** About section. One array entry = one paragraph. */
  about: z.array(z.string().min(1)),
  location: z.string(),
  email: z.string().email(),
  /** Leave empty to hide the phone number on the public site. */
  phone: z.string(),
  photo: assetPath,
  photoAlt: z.string(),
  available: z.boolean(),
  availabilityText: z.string(),
  resumes: z.array(z.object({ label: z.string().min(1), file: assetPath })),
  socials: z.array(socialSchema),
});

export const statSchema = z.object({ value: z.string().min(1), label: z.string().min(1) });

export const experienceSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  companyUrl: safeUrl.or(z.literal("")),
  location: z.string(),
  /** Free text, e.g. "Jan 2026". */
  start: z.string().min(1),
  /** Free text; ignored when current = true. */
  end: z.string(),
  current: z.boolean(),
  highlights: z.array(z.string().min(1)),
  tech: z.array(z.string().min(1)),
  links: z.array(linkSchema),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  tagline: z.string(),
  description: z.string().min(1),
  /** Filter chip on the public site. */
  category: z.enum(["Mobile", "AI & ML", "Web"]),
  tech: z.array(z.string().min(1)),
  /** Optional cover. When empty the site renders a designed fallback cover. */
  image: assetPath,
  imageAlt: z.string(),
  links: z.array(linkSchema),
  featured: z.boolean(),
  /** Hidden projects stay in the admin but are not published. */
  hidden: z.boolean(),
});

export const researchSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  /** Headline number, e.g. "93.47%". May be empty. */
  metric: z.string(),
  metricLabel: z.string(),
  tech: z.array(z.string().min(1)),
  links: z.array(linkSchema),
});

export const educationSchema = z.object({
  id: z.string().min(1),
  school: z.string().min(1),
  degree: z.string().min(1),
  period: z.string().min(1),
  grade: z.string(),
  note: z.string(),
});

export const skillGroupSchema = z.object({
  id: z.string().min(1),
  group: z.string().min(1),
  items: z.array(z.string().min(1)),
});

export const achievementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string(),
});

export const settingsSchema = z.object({
  siteTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  /** Show or hide whole sections on the public site. */
  sections: z.object({
    about: z.boolean(),
    experience: z.boolean(),
    projects: z.boolean(),
    research: z.boolean(),
    skills: z.boolean(),
    education: z.boolean(),
    achievements: z.boolean(),
    contact: z.boolean(),
  }),
});

export const contentSchema = z.object({
  settings: settingsSchema,
  profile: profileSchema,
  stats: z.array(statSchema),
  experience: z.array(experienceSchema),
  projects: z.array(projectSchema),
  research: z.array(researchSchema),
  education: z.array(educationSchema),
  skills: z.array(skillGroupSchema),
  achievements: z.array(achievementSchema),
});

export type Content = z.infer<typeof contentSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Research = z.infer<typeof researchSchema>;
export type Education = z.infer<typeof educationSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Achievement = z.infer<typeof achievementSchema>;
export type Settings = z.infer<typeof settingsSchema>;
