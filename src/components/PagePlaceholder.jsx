export default function PagePlaceholder({ title, section }) {
  return (
    <div className="page-shell">
      <div className="page-hero">
        <p>{section}</p>
        <h2>{title}</h2>
        <span>This screen is ready to be implemented next.</span>
      </div>
    </div>
  );
}
