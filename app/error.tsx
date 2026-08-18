"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-page">
      <p className="section-kicker">Error</p>
      <h1>Something went wrong.</h1>
      <p>The page could not be loaded.</p>
      <button className="hero-action" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
