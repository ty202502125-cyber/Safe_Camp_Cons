export function Stat({ label, value, detail }) {
  return (
    <article className="card stat">
      <div className="st">
        <span>{label}</span>
      </div>
      <div className="sv">{value}</div>
      <div className="sd">{detail}</div>
    </article>
  );
}
