export function Panel({ eyebrow, title, sub, action, children }) {
  return (
    <section className="card panel">
      <div className="ph">
        <div>
          <span className="eb">{eyebrow}</span>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
