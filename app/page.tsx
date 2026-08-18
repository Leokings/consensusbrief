import { connection } from "next/server";
import { BriefBuilder } from "@/components/brief-builder";
import { SiteHeader } from "@/components/site-header";
import { WalletArchive } from "@/components/wallet-archive";
import { isDatabaseConfigured } from "@/db";

export default async function HomePage() {
  await connection();

  const databaseReady = isDatabaseConfigured();

  return (
    <div className="site-shell">
      <SiteHeader />
      <div className="app-frame">
        <main className="workspace-main">
          <section className="workspace-bar">
            <div>
              <p className="workspace-path">New brief</p>
              <h1>Build a consensus brief.</h1>
              <p className="workspace-summary">Paste a source. Choose a length. Submit.</p>
            </div>
          </section>

          <BriefBuilder databaseReady={databaseReady} />

          <WalletArchive databaseReady={databaseReady} />
        </main>
        <footer>
          <span>ConsensusBrief · StudioNet</span>
        </footer>
      </div>
    </div>
  );
}
