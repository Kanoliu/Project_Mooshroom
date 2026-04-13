# Project Mooshroom

Phone pet prototype built with Next.js as an installable Progressive Web App.

## Stack

- Next.js App Router
- TypeScript
- ESLint
- Web app manifest
- Service worker registration

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

Create a local `.env.local` from `.env.example` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`
- `SUPABASE_SERVICE_ROLE_KEY`

Before checking art updates in the app, sync editable assets from `art-resources/` into `public/art/`:

```bash
npm run sync:art
```

If your PowerShell prompt shows a `\\?\` path and `npm run sync:art` fails, use the PowerShell-native script instead:

```powershell
.\scripts\sync-art.ps1
```

## Project Notes

- The manifest is generated from `src/app/manifest.ts`.
- The service worker lives at `public/sw.js` and is only registered in production.
- The main landing page is in `src/app/page.tsx`.
- Push subscriptions are managed through `src/app/api/push/*` and stored in `public.web_push_subscriptions`.
- Supabase auth sends an email OTP and magic link. Home Screen PWA users should enter the email code in the installed app because iOS opens email links in Safari with separate auth storage.
- Add the deployed `/auth/callback` URL to the Supabase Auth redirect allow list alongside `NEXT_PUBLIC_APP_URL`.
- Editable art sources live in `art-resources/`.
- Runtime app assets live in `public/art/`.

## Next Steps

- Add pet interactions and status systems.
- Decide on deployment target and environment variable strategy.
- Expand the service worker caching strategy once real routes and assets exist.
