# Project Mooshroom

Initial Next.js setup for an installable Progressive Web App.

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

## Project Notes

- The manifest is generated from `src/app/manifest.ts`.
- The service worker lives at `public/sw.js` and is only registered in production.
- The main landing page is in `src/app/page.tsx`.

## Next Steps

- Replace the starter landing page with the first real product flow.
- Decide on deployment target and environment variable strategy.
- Expand the service worker caching strategy once real routes and assets exist.
