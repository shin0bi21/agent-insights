import Live from '../Live/Live';
import { eyebrowClass, mutedTextClass, pageTitleClass } from '../../ui';

export default function Sessions() {
  return (
    <section aria-labelledby="sessions-title">
      <div className="mb-8">
        <p className={eyebrowClass}>SESSION TELEMETRY</p>
        <h2 id="sessions-title" className={pageTitleClass}>Session Review</h2>
        <p className={mutedTextClass}>Watch a session as it changes or generate a frozen review in the same dashboard.</p>
      </div>
      <Live embedded />
    </section>
  );
}
