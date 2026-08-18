import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="empty-page">
        <p className="section-kicker">404</p>
        <h1>Brief not found.</h1>
        <p>The share link is invalid or has not been indexed yet.</p>
        <Link className="hero-action" href="/">
          Return home
        </Link>
      </main>
    </div>
  );
}
