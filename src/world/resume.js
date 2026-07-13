const BASE = import.meta.env.BASE_URL;

export const RESUME_PDF_SRC = `${BASE}resume.pdf`;
export const RESUME_PDF_HREF = `${RESUME_PDF_SRC}#page=1`;

export const RESUME_ZONE = {
  tag: "Resume",
  title: "Resume",
  body:
    "IT support specialist with 3+ years troubleshooting hardware, software, and networking for small businesses, and a full-stack developer building web apps with Rust, JavaScript, Vue, and Python.",
  links: [{ label: "View full resume (PDF)", href: RESUME_PDF_HREF }],
};
