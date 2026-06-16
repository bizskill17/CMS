function IconSvg({ name }) {
  const icons = {
    cards: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </>
    ),
    table: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
        <path d="M3.5 10h17M3.5 14.5h17M9 5v14M15 5v14" />
      </>
    ),
    followup: (
      <>
        <path d="M7.5 5.5h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3v-3H7.5A2.5 2.5 0 0 1 5 13V8a2.5 2.5 0 0 1 2.5-2.5Z" />
        <path d="M9 10h6M9 12.75h4" />
      </>
    ),
    payment: (
      <>
        <path d="M7 6h9" />
        <path d="M7 10h9" />
        <path d="M7 6c4 0 6 1.7 6 4s-2 4-6 4h2l6 4" />
      </>
    ),
    upload: (
      <>
        <path d="M11 16h2V7.83l2.58 2.59L17 9l-5-5-5 5 1.42 1.41L11 7.83V16zm-7 2h16v2H4v-2z" />
      </>
    ),
    renew: (
      <>
        <path d="M5.5 12.5 9.5 16.5 18.5 7.5" />
      </>
    ),
    filter: (
      <>
        <path d="M4 6h16" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 3.5 3.5" />
      </>
    ),
    excel: (
      <>
        <path d="M14 3.5h-6A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h8A2.5 2.5 0 0 0 18.5 18V8Z" />
        <path d="M14 3.5V8h4.5" />
        <path d="m8.5 11.5 4 5" />
        <path d="m12.5 11.5-4 5" />
      </>
    ),
    pdf: (
      <>
        <path d="M14 3.5h-6A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h8A2.5 2.5 0 0 0 18.5 18V8Z" />
        <path d="M14 3.5V8h4.5" />
        <path d="M9 15v-4.5h1.5a1.5 1.5 0 1 1 0 3H9" />
        <path d="M13 10.5h1.5a2 2 0 0 1 0 4H13v-4z" />
      </>
    )
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

export function ActionIconButton({ icon, label, tone = "secondary", className = "", ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-action-button icon-action-button--${tone} ${className}`}
      {...props}
    >
      <IconSvg name={icon} />
    </button>
  );
}

export function ActionIconDisplay({
  icon,
  label,
  active = false,
  onClick,
  variant = "icon",
  showLabel = false,
  className = ""
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-toggle-button icon-toggle-button--${variant} icon-toggle-button--${icon} ${active ? "is-active" : ""} ${className}`}
      onClick={onClick}
    >
      <IconSvg name={icon} />
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
