const pageSizeOptions = [10, 25, 50, 100];

function buildVisiblePages(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }

  if (currentPage >= totalPages - 2) {
    return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
}

export default function TablePagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const visiblePages = buildVisiblePages(currentPage, totalPages);

  return (
    <div className="table-pagination" aria-label="Pagination">
      <div className="table-pagination__controls">
        <button
          type="button"
          className="table-pagination__icon"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          &#171;
        </button>
        <button
          type="button"
          className="table-pagination__icon"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          &#8249;
        </button>

        {visiblePages.map((page) => (
          <button
            key={page}
            type="button"
            className={`table-pagination__page${page === currentPage ? " is-active" : ""}`}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          className="table-pagination__icon"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          &#8250;
        </button>
        <button
          type="button"
          className="table-pagination__icon"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          &#187;
        </button>
      </div>

      <div className="table-pagination__size">
        <label className="table-pagination__select-wrap">
          <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <span>Items per page</span>
      </div>
    </div>
  );
}
