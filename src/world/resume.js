const BASE = import.meta.env.BASE_URL;

export const RESUME_PDF_SRC = `${BASE}resume.pdf`;
export const RESUME_PDF_HREF = `${RESUME_PDF_SRC}#page=1`;

export const RESUME_ZONE = {
  tag: "Resume",
  title: "Resume",
  body:
    "Your full resume floats beside the path — open the PDF for a downloadable copy with every detail.",
  links: [{ label: "View full resume (PDF)", href: RESUME_PDF_HREF }],
};
