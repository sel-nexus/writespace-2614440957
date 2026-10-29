/** Present a count with an explicit population so similar labels remain distinguishable. */
import PropTypes from 'prop-types';

const accents = {
  indigo: 'border-t-indigo-500',
  violet: 'border-t-violet-500',
  pink: 'border-t-pink-500',
  teal: 'border-t-teal-500',
};

/** Render one verified statistic without inventing trends or activity measures.
 * @param {object} props Unique id, exact label, count, population explanation and accent.
 * @returns {JSX.Element} A named, described statistic with tabular numerals.
 */
export function StatCard({ id, label, count, description, accent = 'indigo' }) {
  return (
    <section
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-description`}
      className={`rounded-lg border border-t-4 border-slate-200 bg-white p-5 ${accents[accent]}`}
    >
      <h2 id={`${id}-label`} className="text-sm font-medium text-slate-700">
        {label}
      </h2>
      <p className="mt-3 text-4xl font-semibold tabular-nums text-slate-900">
        {count}
      </p>
      <p id={`${id}-description`} className="mt-3 text-sm text-slate-600">
        {description}
      </p>
    </section>
  );
}

StatCard.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  description: PropTypes.string.isRequired,
  accent: PropTypes.oneOf(Object.keys(accents)),
};
