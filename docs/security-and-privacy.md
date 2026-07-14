# Kova — Security & Privacy

Privacy is the brand promise: local-first, no bank linking, no accounts, no telemetry, no
external calls in the MVP.

## Current state (honest)

| Control | Status |
|---|---|
| Data locality | ✅ Everything in this browser's IndexedDB; zero network calls at runtime |
| Owner scoping | ✅ Every row carries `userId`; every query filters by it (RLS-shaped) |
| Input validation | ✅ `normalizeMoneyInput`, zod schemas on all AI output, date regex, bounds |
| AI containment | ✅ Propose→validate→approve→audit pipeline; no direct mutations |
| Audit trail | ✅ `ai_action_audit_logs` + Settings viewer (proposals, approvals, rejections, plan changes) |
| Export / delete | ✅ Full JSON export; delete-everything with confirmation |
| Secrets in client | ✅ None exist; `.env.example` documents that keys must live behind a server proxy |
| Document retention | ✅ Paystub documents not retained by default (`retained` flag; MVP stores only synthetic fixture refs) |
| PII in logs | ✅ No console logging of amounts/names in app code |
| **Encryption at rest** | ⚠️ **Gap.** IndexedDB is not encrypted the way SQLCipher is. Acceptable ONLY because all MVP data is synthetic. Production path: RN/Expo + expo-sqlite/SQLCipher with the key in Keychain (decision D3), or web OPFS + WebCrypto envelope encryption. |
| Encryption in transit | N/A in MVP (no transit). Any future sync/proxy is TLS-only. |
| Rate limiting / signed URLs | N/A until a backend exists; required for the cloud proxy design. |
| Biometric app lock | Deferred to the native port (expo-local-authentication). |

## Threat model

- **Broken access control** — single-owner MVP; the owner-scoped query pattern and schema shape
  make multi-user RLS a mechanical translation, not a redesign. Tests assert owner scoping.
- **Injection** — no SQL strings (Dexie structured API), no `dangerouslySetInnerHTML`, React
  escaping throughout; money/date inputs parsed by strict grammars.
- **Insecure storage** — see encryption gap above; synthetic-only data policy enforced in seeds,
  fixtures, tests, and docs.
- **Prompt injection (documents/notes)** — a hostile paystub or note can at worst influence
  *proposals*: output is schema-whitelisted (unknown fields/actions rejected), every mutation
  needs human approval, and rejected outputs are audit-logged. The mock provider is not
  instruction-following, which reduces this to zero in MVP; the pipeline is what protects real
  providers later.
- **Malicious document uploads** — MVP accepts no real uploads (fixtures only). The adapter
  boundary is where size/type/content validation attaches when a real extractor lands.
- **AI-tool abuse** — providers have no tools; they return data. Action allowlist is the zod
  discriminated union; anything else fails closed.
- **Supply chain** — small dependency set, `npm audit` clean at install time, lockfile committed.

## Privacy copy commitments (shipping in UI)

- Onboarding explains memory before asking; consent never preselected.
- Scan flow states nothing is saved before confirmation.
- Settings → Intelligence answers "do images leave this device?" (No) and states the exact
  fallback behavior and what a future cloud provider would receive (structured summaries, never
  paystub images).
