export default function RecordDetailModal({ isOpen, title, rows, actions = null, onClose }) {
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
              <span className="record-detail__actions-label">Actions</span>
              <div className="table-actions">{actions}</div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="master-table record-detail__table">
              <thead>
                <tr>
                  <th>Field Name</th>
                  <th>Field Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="record-detail__field">{row.label}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button form-actions__cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
