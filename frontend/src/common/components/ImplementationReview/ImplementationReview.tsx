import type { ImplementationReviewSection } from '../../../types';
import './ImplementationReview.css';

export default function ImplementationReview({ sections }: { sections: ImplementationReviewSection[] }) {
  return <div className="implementation-review">
    <h3>Implementation review</h3>
    {sections.map(section => <section key={section.id} className="review-section">
      <h4>{section.label}</h4>
      {section.items.map(item => <details key={item.id} className={`review-item ${item.implemented ? 'implemented' : 'missing'}`}>
        <summary><span>{item.label}</span><strong>{item.implemented ? 'Implemented' : 'Missing'}</strong></summary>
        <div className="review-evidence">
          <Evidence title="Agent output" files={item.candidateFiles} empty="No matching files created." />
          <Evidence title="Reference implementation" files={item.referenceFiles} empty="No matching reference files." />
        </div>
      </details>)}
    </section>)}
  </div>;
}

function Evidence({ title, files, empty }: { title: string; files: string[]; empty: string }) {
  return <div><h5>{title}</h5>{files.length ? <ul>{files.map(file => <li key={file}>{file}</li>)}</ul> : <p>{empty}</p>}</div>;
}
