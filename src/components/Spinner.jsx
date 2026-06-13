export function Spinner({ label = "Loading", size = "md", light = false }) {
  return (
    <span className={`spinner-wrap spinner-wrap--${size} ${light ? "spinner-wrap--light" : ""}`}>
      <span className="spinner" aria-hidden="true"></span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function ButtonSpinner({ label }) {
  return <Spinner label={label} size="sm" light />;
}
