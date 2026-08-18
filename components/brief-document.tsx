import type { ConsensusBriefRecord } from "@/lib/brief";

export function BriefDocument({
  record,
  compact = false,
}: {
  record: ConsensusBriefRecord;
  compact?: boolean;
}) {
  return (
    <article className={`brief-document${compact ? " brief-document-compact" : ""}`}>
      <header className="brief-document-header">
        <div className="brief-document-status">
          <span><i aria-hidden="true" /> Consensus complete</span>
          <span>StudioNet</span>
        </div>
        <h2>{record.brief.title}</h2>
        <div className="brief-document-meta">
          <span>{record.brief.word_count} words</span>
          <span>{record.target_words}-word setting</span>
          <span>Validator-backed</span>
        </div>
      </header>

      <section className="brief-lead">
        <span className="brief-index">00</span>
        <div>
          <h3>Executive summary</h3>
          <p>{record.brief.executive_summary}</p>
        </div>
      </section>

      <div className="brief-section-grid">
        <section className="brief-panel">
          <div className="brief-panel-heading">
            <span className="brief-index">01</span>
            <h3>Shared ground</h3>
          </div>
          <ul>
            {record.brief.shared_ground.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="brief-panel">
          <div className="brief-panel-heading">
            <span className="brief-index">02</span>
            <h3>Key considerations</h3>
          </div>
          <ul>
            {record.brief.key_considerations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="brief-questions">
        <div className="brief-panel-heading">
          <span className="brief-index">03</span>
          <h3>Open questions</h3>
        </div>
        <ol>
          {record.brief.open_questions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="next-step">
        <span className="brief-index">04</span>
        <div>
          <h3>Recommended next step</h3>
          <p>{record.brief.recommended_next_step}</p>
        </div>
      </section>
    </article>
  );
}
