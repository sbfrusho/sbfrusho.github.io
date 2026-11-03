/** Build-time accessor used by the public site. A schema error fails the build, so bad content never deploys. */
import raw from "@/data/content.json";
import { contentSchema } from "./schema";

export const content = contentSchema.parse(raw);
