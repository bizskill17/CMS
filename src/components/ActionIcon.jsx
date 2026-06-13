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
        <path d="M7.5 3.5h6l3 3V18a2 2 0 0 1-2 2h-7A2.5 2.5 0 0 1 5 17.5V6a2.5 2.5 0 0 1 2.5-2.5Z" />
        <path d="M13.5 3.5V7h3" />
        <path d="M11 10v5" />
        <path d="m8.5 12.5 2.5-2.5 2.5 2.5" />
      </>
    ),
    renew: (
      <>
        <path d="M6 8a7 7 0 1 1 1.8 8.9" />
        <path d="M6 4v5h5" />
      </>
    ),
    filter: (
      <>
        <path d="M4 6h16" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
      </>
    ),
    excel: (
      <>
        <path d="M14 3.5h-6A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h8A2.5 2.5 0 0 0 18.5 18V8Z" />
        <path d="M14 3.5V8h4.5" />
        <path d="m8.5 11.5 4 5" />
        <path d="m12.5 11.5-4 5" />
      </>
    )
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

export function ActionIconButton({ icon, label, tone = "secondary", ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-action-button icon-action-button--${tone}`}
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
  showLabel = false
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-toggle-button icon-toggle-button--${variant} ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <IconSvg name={icon} />
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}
