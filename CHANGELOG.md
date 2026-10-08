# Changelog

## v4.1.0 — 2026-10-08

- Refocused the research workspace on a single reading order: project title (click to switch), a four-segment progress bar, one "what to do now" card, then quiet source and record lists.
- The focus card shows only the conditions that differ or need checking, with values linked to their source lines; matching conditions collapse into one line, including unit-normalized matches.
- Removed the dark hero, animated connectome, purple action tile, match donut and lab-status tiles from the dashboard; the connectome remains on the routing screen and lab status links to Today.
- Calmer shell: accent-tinted active navigation, outlined presentation button, and the Korean tagline under the logo. The Today banner uses the same light focus style.
- Mobile menu drawer now stays within the screen height so the account controls remain reachable.
- Deployed to https://flylabs-research.vercel.app (deployment `dpl_acoKe5fAAKgwjmU2r9XwjQz48haJ`). Verified: 27 domain/server tests, 17 server browser scenarios, and 11 public-demo scenarios locally and against the live URL.

## v4.0.0 — 2026-10-08

- Redesigned the whole interface: light floating sidebar grouped into research flow and lab operations, a command bar with storage status, `⌘K` / `/` search and a presentation-mode button, and a new visual system bundled with the Pretendard font.
- Rebuilt the research workspace as a bento dashboard: a dark hero with the four-step pipeline and live connectome signal, a "next action" tile that quotes the first differing condition with a link to its source line, a match-rate donut, a differences-first comparison view with unit-normalized matches, source completeness rings, lab status and recent activity.
- Added presentation mode: a guided tour across six screens with talking points, arrow-key navigation and Esc to exit.
- Replaced Unicode glyph icons with a consistent inline SVG icon set and raised all text below 11 px to 11–12 px or larger; Korean text no longer breaks inside words.
- Restyled comparison, preparation, routing, today and notebook screens to match; differing rows are marked with status colour, icon and label.
- Deployed to https://flylabs-research.vercel.app (deployment `dpl_525Bn2cPVcchMVcTanwn2mfmw157`). Verified: 27 domain/server tests, 17 server browser scenarios, and 11 public-demo browser scenarios both locally and against the live URL, including the new dashboard and presentation checks.

## v3.1.0 — 2026-10-08

- Public browser prototype at https://flylabs-research.vercel.app with IndexedDB storage and no external AI connection.
- Shared evidence comparison, source revisions, preparation snapshots, notebooks, binary attachments and exports.
- Synthetic examples for experimental, computational, qualitative and theoretical research.
- Preserved authenticated Node/SQLite variant with roles, invitations and reviewed AI proposals/drafts.
- Production demo verified in 10 browser scenarios; 27 domain/server tests and 17 server browser scenarios passed.
- GitHub publication includes current documentation, deployment configuration and continuous integration. Server AI browser QA uses simulated responses.
- Corrected the example API port to 4211 to match the current development proxy.

OpenShell execution isolation, GPT/Claude integration, institution-level deployment and completed external-lab validation remain planned.
