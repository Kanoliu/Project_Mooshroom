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
- Editable art sources live in `art-resources/`.
- Runtime app assets live in `public/art/`.

## Next Steps

- Add pet interactions and status systems.
- Decide on deployment target and environment variable strategy.
- Expand the service worker caching strategy once real routes and assets exist.
