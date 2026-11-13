import type { ScienceSection } from "../types";

/** The repository's files on GitHub, on the main branch. */
export const REPO_BLOB_URL = "https://github.com/anahmed404/TrueSouth/blob/main/";

/** "Science notes, section 4": how a card names the section it quotes. */
export function sectionLabel(section: ScienceSection): string {
  return `Science notes, section ${section.number}`;
}

/**
 * The heading's anchor as GitHub writes it: lower case, punctuation dropped, spaces to
 * hyphens. "4. How high a piece of terrain looks" → "4-how-high-a-piece-of-terrain-looks";
 * "3.1 One pull for the whole Moon" → "31-one-pull-for-the-whole-moon".
 */
export function headingAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** The heading's text in docs/science.md: "4. Title" for a section, "3.1 Title" for a subsection. */
export function sectionHeading(section: ScienceSection): string {
  return section.number.includes(".") ? `${section.number} ${section.title}` : `${section.number}. ${section.title}`;
}

/** A link to the quoted section of docs/science.md. */
export function sectionUrl(section: ScienceSection): string {
  return `${REPO_BLOB_URL}docs/science.md#${headingAnchor(sectionHeading(section))}`;
}

/** A link to a file in the repository. */
export function fileUrl(file: string): string {
  return `${REPO_BLOB_URL}${file}`;
}

/** The last part of a path: "science/src/truesouth/skyline.py" → "skyline.py". */
export function fileName(file: string): string {
  return file.split("/").pop() ?? file;
}
