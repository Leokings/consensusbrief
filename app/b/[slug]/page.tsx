import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefDocument } from "@/components/brief-document";
import { SiteHeader } from "@/components/site-header";
import { briefIdPattern } from "@/lib/brief";
import { getSharedBrief } from "@/lib/data";
import { transactionUrl } from "@/lib/deployment";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!briefIdPattern.test(slug)) return { title: "Brief not found" };
  const row = await getSharedBrief(slug).catch(() => null);
  if (!row) return { title: "Brief not found" };
  return {
    title: row.contractRecord.brief.title,
    description: row.contractRecord.brief.executive_summary.slice(0, 155),
  };
}

export default async function SharedBriefPage({ params }: Props) {
  const { slug } = await params;
  if (!briefIdPattern.test(slug)) notFound();
  const row = await getSharedBrief(slug).catch(() => null);
  if (!row) notFound();
  const record = row.contractRecord;

  return (
    <div className="site-shell shared-shell">
      <SiteHeader />
      <div className="app-frame">
        <main className="shared-main">
          <div className="shared-page-head">
            <div>
              <Link href="/">← Back to workspace</Link>
              <p>Brief / {record.id}</p>
            </div>
            <nav className="shared-nav" aria-label="Export brief">
              <span>Export</span>
              <a href={`/api/briefs/${slug}/export?format=pdf`}>PDF</a>
              <a href={`/api/briefs/${slug}/export?format=docx`}>DOCX</a>
              <a href={`/api/briefs/${slug}/export?format=txt`}>TXT</a>
            </nav>
          </div>

          <div className="shared-layout">
            <BriefDocument record={record} />

            <aside className="shared-sidecar">
              <section className="proof-card">
                <div className="proof-heading">
                  <span className="proof-mark" aria-hidden="true">✓</span>
                  <div>
                    <p className="sidecar-label">On-chain proof</p>
                    <h2>Validator accepted</h2>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Creator</dt>
                    <dd>{record.creator}</dd>
                  </div>
                  <div>
                    <dt>Contract</dt>
                    <dd>{row.contractAddress}</dd>
                  </div>
                  <div>
                    <dt>Transaction</dt>
                    <dd>
                      <a
                        href={transactionUrl(row.transactionHash)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in explorer ↗
                      </a>
                    </dd>
                  </div>
                </dl>
              </section>

              <details className="source-disclosure">
                <summary>
                  <span>Original source</span>
                  <small>{record.source_word_count} words</small>
                </summary>
                <pre>{record.source_text}</pre>
              </details>
            </aside>
          </div>
        </main>
        <footer>
          <span>ConsensusBrief · StudioNet</span>
        </footer>
      </div>
    </div>
  );
}
