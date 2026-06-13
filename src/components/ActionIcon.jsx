function IconSvg({ name }) {
  const icons = {
    cards: <path d="M4 5h7v6H4V5Zm9 0h7v4h-7V5ZM4 13h5v6H4v-6Zm7 0h9v6h-9v-6Z" />,
    table: (
      <>
        <path d="M4 6h16v12H4V6Zm0 4h16M9 6v12M15 6v12" />
      </>
    ),
    followup: (
      <>
        <path d="M12 3a8 8 0 1 0 8 8" />
        <path d="M12 7v5l3 2" />
        <path d="M19 3v5h-5" />
      </>
    ),
    payment: (
      <>
        <path d="M3 7h18v10H3V7Zm2 2v6h14V9H5Z" />
        <path d="M15 5V3M9 5V3M7 12h4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 15V5" />
        <path d="m8 9 4-4 4 4" />
        <path d="M5 17v2h14v-2" />
      </>
    ),
    renew: (
      <>
        <path d="M6 8a7 7 0 1 1-1 7" />
        <path d="M6 3v5h5" />
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

export function ActionIconDisplay({ icon, label, active = false, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-toggle-button ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      <IconSvg name={icon} />
    </button>
  );
}
