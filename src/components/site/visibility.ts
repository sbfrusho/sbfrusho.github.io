/** One place that decides which sections exist, used by the page, the nav and the 404 header. */
import { content } from "@/lib/content";

const { settings, profile, experience, projects, research, skills, education, achievements } = content;
const on = settings.sections;

export const visibleProjects = projects.filter((p) => !p.hidden);
export const visibleSkills = skills.filter((g) => g.items.length > 0);

export const show = {
  about: on.about && profile.about.length > 0,
  experience: on.experience && experience.length > 0,
  projects: on.projects && visibleProjects.length > 0,
  research: on.research && research.length > 0,
  skills: on.skills && visibleSkills.length > 0,
  education: on.education && education.length > 0,
  achievements: on.achievements && achievements.length > 0,
  contact: on.contact,
};

export const navItems = [
  { id: "about", label: "About", visible: show.about },
  { id: "experience", label: "Experience", visible: show.experience },
  { id: "projects", label: "Projects", visible: show.projects },
  { id: "research", label: "Research", visible: show.research },
  { id: "skills", label: "Skills", visible: show.skills },
  { id: "education", label: "Education", visible: show.education },
  { id: "achievements", label: "Recognition", visible: show.achievements },
  { id: "contact", label: "Contact", visible: show.contact },
].filter((item) => item.visible);
