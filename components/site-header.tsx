import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="ConsensusBrief home">
        <span className="wordmark-mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <span className="wordmark-copy">
          <strong>Consensus</strong>
          <small>Brief</small>
        </span>
      </Link>

      <nav className="site-nav" aria-label="Primary navigation">
        <Link href="/#create">
          <span aria-hidden="true">＋</span>
          New brief
        </Link>
        <Link href="/#archive">
          <span aria-hidden="true">□</span>
          Archive
        </Link>
      </nav>

      <div className="sidebar-status">
        <span className="network-chip">
          <i aria-hidden="true" /> StudioNet live
        </span>
      </div>
    </header>
  );
}
