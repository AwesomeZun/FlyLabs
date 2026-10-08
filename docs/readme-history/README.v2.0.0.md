# FlyLabs v2.0.0

**A research notebook that connects experiment plans, actual work, results, and the people who continue the work.**

FlyLabs supports individual graduate students, academic laboratories, and biotech R&D teams. It combines a structured lab notebook with resource readiness, equipment reservations, original attachments, and handover records. The application interface is Korean. [한국어 안내](README.ko.md)

## Start

Node.js **22.16+** is required. Verified on Node.js 22.22.3.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4190**. The API runs on 4191. Both bind to the local computer by default. The preserved v1.0.0 uses different ports.

Create your own account from the registration tab; no default password or demonstration login is installed. Each account receives a private workspace. The first registered account also takes ownership of any imported v1 workspaces that have no owner yet. The bundled academic and biotech examples are fictional and labeled as such.

For the production build:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:4191**. Use one API process per data directory.

## Research notebook

Each experiment has ten separate sections: objective, hypothesis/question, design, samples/materials/conditions, procedure, observations, analysis, conclusion, limitations, and next steps. Researchers supply the experimental content.

- **Plans and results:** edit structured sections together, with an explicit save and revision reason.
- **Execution log:** append timestamped work records; corrections link to the original entry rather than deleting it.
- **Draft recovery:** unfinished edits are stored in this browser tab's session storage and offered again when editing resumes. They are not server records until saved. Closing the tab can remove them; logout clears them.
- **Revision history:** previous section values, change reasons, account identities, and timestamps remain available. Concurrent saves against an old revision return a conflict rather than overwriting newer work.
- **Review signature:** an authenticated account can lock the current notebook after entering objective, observations, and conclusion. Further notebook edits, execution entries, and attachments require reopening a new revision with a reason. The former signature and content remain in history.
- **Export:** download notebook Markdown, a handover that includes notebook content, or workspace JSON metadata.

The review signature is an application-level account confirmation and editing lock, not a certified digital signature or a compliance claim. Experiment operational metadata and progress discussions remain separate from the signed notebook.

## AI with explicit review

### Jev: operational judgments

Jev classifies a selected progress note and proposes an experiment status. The app sends only that note, the experiment title, and the current status to TypeSafe. Validated confidence below 0.7 produces no proposal. The original note persists; a researcher must explicitly apply a proposed change. If the experiment changes during inference, no action is attached to the response.

### Gemini: plan and result organization

Gemini organizes selected source text into a draft. Researchers choose whether to include current notebook fields, the latest 20 execution entries, and up to three eligible text attachments (UTF-8 `.txt`, `.md`, `.csv`, `.tsv`, `.json`, each at most 100 KB). Other attachments are not transmitted.

Planning drafts cannot populate observations or conclusions. Results drafts separate observations, interpretation, limitations, and conclusions. Missing inputs are returned as questions. Allowed fields and citation IDs are validated server-side. The source text, model name, generation time, and base revision are retained with each draft. Reviewers choose the fields to replace; generation never saves over their notebook. Stale drafts cannot be applied.

AI output still needs scientific review. Source-ID validation confirms traceability, not that every generated statement is correct. API failures preserve the form and do not silently switch providers or substitute rules.

### Configuration

Copy `.env.example` to `.env`, set `JEV_API_KEY` and `GEMINI_API_KEY`, then restart. Alternatively, set `FLYLABS_ENV_FILE` to an existing provider file. The loader reads only an explicit allowlist and recognizes `TYPESAFE-AI-API-KEY` and `TYPESAFE_API_KEY` as aliases for Jev. Credentials are never sent to the browser or placed in exports. NVIDIA credentials may be present in the source file but are not used by this release.

Current defaults are `jev-1.13.0` and `gemini-3.1-flash-lite`. The configured account successfully completed Jev classification and Gemini plan/result calls using synthetic inputs. See [live verification](docs/live-ai-check.json). The older Gemini 2.5 Flash endpoint rejected generation for this account, so the implementation uses the verified 3.1 Flash Lite model.

Provider documentation: [TypeSafe](https://docs.typesafe.ai/introduction), [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

## Team workspaces

- Passwords are salted and hashed with scrypt; sessions use expiring HttpOnly, SameSite=Strict cookies. Password changes revoke other sessions.
- Workspace owners invite an exact email identity as an **editor** or **viewer**. Invitations expire after seven days, can be used once, and can be canceled before use.
- Owners can change editor/viewer permissions or remove access. Prior authored records remain attributable.
- Editors can write records, attach files, review proposals, and use AI. Viewers can read and export; writes are rejected by the API.
- The server derives the record author from the authenticated account. Client-supplied actor IDs cannot impersonate another researcher.
- Other researchers' changes are checked on window focus and every 15 seconds while visible. This is not simultaneous keystroke-level editing.

Invitations are copied and shared manually. No emails are sent. Email addresses are login identifiers and are not verified through an email provider. Self-service password recovery, SSO, and MFA are not included. Do not use an email address alone as evidence of institutional identity.

## Operations and storage

Inventory quantities and statuses are manually confirmed; stock is not automatically consumed. Required resources and equipment reservations are linked to experiments. Overlapping equipment bookings are rejected. Completing an operational experiment still requires checked preparation items and an attached result file.

SQLite stores accounts and workspace records in `.data/flylabs.sqlite`; original attachments are in `.data/uploads/`. Attachments have SHA-256 hashes and a 10 MB limit. Files are downloaded as attachments; PDF/image content is not analyzed by the notebook AI.

Full backup, verification, and restoration are available:

```sh
npm run backup -- /absolute/path/to/new-backup-directory
node scripts/backup.mjs verify /absolute/path/to/backup-directory
node scripts/backup.mjs restore /absolute/path/to/backup-directory /absolute/path/to/new-data-directory
```

A consistent SQLite snapshot and all referenced attachment bytes are copied. Database integrity, file sizes, and hashes are checked. Existing destinations are never overwritten. Active sessions are removed from snapshots, so restored users log in again. Configure `FLYLABS_DATA_DIR` to use a restored directory. Backups contain account password hashes and research records; keep them private. Provider secrets are not included. Workspace JSON exports are metadata exports, not full backups or an import format.

For access from other computers, run the production build behind an HTTPS reverse proxy, set `PUBLIC_ORIGIN` to its exact origin, and configure `HOST` for that deployment. Secure cookies are enabled for an HTTPS public origin. This delivery is running locally; no public deployment, domain, or mail service has been provisioned.

## Verification

```sh
npm test
npm run build
npx playwright install chromium # only if needed
npm run qa
```

Tests cover authentication, session revocation, invitations, access control, author binding, notebook revisions and signatures, concurrent changes, file isolation, AI scope validation, booking conflicts, persistence, and full backup/restore. Browser QA uses isolated temporary databases and simulated provider transports, including two independent account sessions. Actual provider calls are recorded separately and use synthetic data only.

Evidence: `docs/qa-report.json`, `docs/live-ai-check.json`, and `docs/qa-*.png`. The original v1 source baseline is recorded in `docs/v1-baseline.json`. New development is contained in this v2.0.0 folder.

## Structure

```text
src/           React application, notebook, forms, account and team UI
server/        HTTP API, authentication, workflow rules, SQLite, AI adapters
scripts/       Development runner, browser QA, full backup/restore
tests/        Domain and integration tests
docs/         Verification evidence
```
