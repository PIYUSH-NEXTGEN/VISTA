export interface SocialPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  mask: "circle" | "square";
  category: "profile" | "post";
}

/** Keep platform dimensions in data so they can be updated without UI changes. */
export const SOCIAL_PRESETS: readonly SocialPreset[] = [
  {
    id: "x-profile",
    label: "X profile photo",
    width: 400,
    height: 400,
    mask: "circle",
    category: "profile",
  },
  {
    id: "x-header",
    label: "X header",
    width: 1500,
    height: 500,
    mask: "square",
    category: "profile",
  },
  {
    id: "x-post",
    label: "X post photo (3:4)",
    width: 1080,
    height: 1440,
    mask: "square",
    category: "post",
  },
  {
    id: "linkedin-post",
    label: "LinkedIn photo post (4:5)",
    width: 1080,
    height: 1350,
    mask: "square",
    category: "post",
  },
  {
    id: "linkedin-link",
    label: "LinkedIn link image",
    width: 1200,
    height: 627,
    mask: "square",
    category: "post",
  },
  {
    id: "square-post",
    label: "Square post",
    width: 1080,
    height: 1080,
    mask: "square",
    category: "post",
  },
  {
    id: "vertical-story",
    label: "Vertical story",
    width: 1080,
    height: 1920,
    mask: "square",
    category: "post",
  },
];
