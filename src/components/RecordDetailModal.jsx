export default function RecordDetailModal({ isOpen, title, rows, actions = null, children = null, onClose }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="record-detail-title">
      <div className="master-modal__backdrop" onClick={onClose} />
      <section className="master-card master-modal__panel master-modal__panel--wide">
        <div className="master-card__header">
          <h3 id="record-detail-title">{title}</h3>
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="master-modal__body">
          {actions ? (
            <div className="record-detail__actions">
              <div className="table-actions">{actions}</div>
            </div>
          ) : null}

          <div className="record-detail__list" role="list" aria-label={`${title} details`}>
            {rows.map((row) => (
              <div key={row.key} className="record-detail__item" role="listitem">
                <div className="record-detail__field">{row.label}</div>
                <div className="record-detail__value">{row.value}</div>
              </div>
            ))}
          </div>

          {children}
        </div>
      </section>
    </div>
  );
}

