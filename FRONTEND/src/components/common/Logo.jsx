import { useState } from "react";
import { LOGO } from "../../data/appData.js";

export function Logo({ big }) {
  const [bad, setBad] = useState(false);
  if (bad) return <div className="mark">W</div>;
  return (
    <img
      className={`logo ${big ? "big" : ""}`}
      src={LOGO}
      alt="WMSU logo"
      onError={() => setBad(true)}
    />
  );
}
