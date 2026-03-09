# i18n Guidelines

- All user-facing UI text must come from `lib/i18n/messages/*`.
- Use `useTranslations()` in client components and server translation helpers in server components.
- Do not introduce new inline UI strings in `app/` and `components/` (except technical allowlist cases).
- For displayed errors, prefer `error code -> localized message` via `lib/i18n/error-messages.ts`.
- Keep `fr` and `en` message keys structurally identical.
- Run `npm run lint:i18n` before merging to catch new hardcoded UI strings.
