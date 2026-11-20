import { IMG } from "../../data/appData.js";

export function Gallery() {
  const t = [
    ["Campus life", IMG.campus],
    ["Community outreach", IMG.volunteer],
    ["Green initiatives", IMG.environment],
    ["Education for all", IMG.education],
  ];
  return (
    <section className="gallery noprint">
      {t.map(([n, i]) => (
        <div key={n} className="gal" style={{ backgroundImage: `url(${i})` }}>
          <span>{n}</span>
        </div>
      ))}
    </section>
  );
}
