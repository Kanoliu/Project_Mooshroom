import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Project Mooshroom</p>
          <h1>Next.js app shell, installable PWA, and a clean place to start building.</h1>
          <p className={styles.copy}>
            This repo is now set up for a product-first build: App Router,
            TypeScript, ESLint, web app manifest support, and a service worker
            ready for iteration.
          </p>
          <div className={styles.ctas}>
            <a
              className={styles.primary}
              href="https://nextjs.org/docs"
              target="_blank"
              rel="noreferrer"
            >
              Read Next.js docs
            </a>
            <a
              className={styles.secondary}
              href="https://web.dev/learn/pwa"
              target="_blank"
              rel="noreferrer"
            >
              PWA guide
            </a>
          </div>
        </section>

        <section className={styles.grid}>
          <article className={styles.card}>
            <span>01</span>
            <h2>App Router baseline</h2>
            <p>Modern Next.js structure with `src/` and TypeScript already in place.</p>
          </article>
          <article className={styles.card}>
            <span>02</span>
            <h2>PWA essentials</h2>
            <p>Manifest, icon, theme color, and service worker registration are wired up.</p>
          </article>
          <article className={styles.card}>
            <span>03</span>
            <h2>Ready for product work</h2>
            <p>Swap this landing screen for real features without redoing the foundation.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
