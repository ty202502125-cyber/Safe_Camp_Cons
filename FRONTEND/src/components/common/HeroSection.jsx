import { Logo } from "./Logo.jsx";

export function Hero({ title, text, children }) {
  return (
    <section className="hero photo">
      <Logo big />

      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </section>
  );
}
