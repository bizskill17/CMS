import { useEffect, useMemo, useState } from "react";
import { ActionIconDisplay } from "./ActionIcon";
import MultiSelectFilter from "./MultiSelectFilter";
import { filterRecords, getRecordValue, sortRecords } from "../utils/dataView";
import { formatCellValue } from "../utils/formatting";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

export default function ResponsiveDataView({
  title,
  records,
  columns,
  loading,
  error,
  loadingMessage,
  emptyMessage,
  searchKeys,
  filterConfigs = [],
  renderActions,
  cardTitle,
  cardSubtitle,
  cardFields,
  rowKey = "id",
  initialSort = null
}) {
  const isMobile = useIsMobile();
  const [preferredView, setPreferredView] = useState("auto");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState(initialSort);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(() =>
    Object.fromEntries(filterConfigs.map((filter) => [filter.key, []]))
  );

  useEffect(() => {
    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
  }, [filterConfigs]);

  const filteredRecords = useMemo(
    () => filterRecords(records, { searchTerm, searchKeys, activeFilters }),
    [records, searchTerm, searchKeys, activeFilters]
  );

  const sortedRecords = useMemo(
    () => sortRecords(filteredRecords, sortConfig),
    [filteredRecords, sortConfig]
  );

  const appliedView = preferredView === "auto" ? (isMobile ? "card" : "table") : preferredView;

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current?.key === key && current.direction === "asc") {
        return { key, direction: "desc" };
      }

      return { key, direction: "asc" };
    });
  };

  const visibleCardFields = cardFields || columns.slice(0, 5);

  return (
    <>
      <div className="master-card__header">
        <span>{title}</span>
        <div className="master-card__actions master-card__actions--header">
          <span>{sortedRecords.length} records</span>
          {filterConfigs.length > 0 ? (
            <ActionIconDisplay
              icon="filter"
              label="Filters"
              active={isFiltersOpen}
              onClick={() => setIsFiltersOpen((current) => !current)}
            />
          ) : null}
          <div className="view-toggle" aria-label="View switcher">
            <ActionIconDisplay
              icon="cards"
              label="Cards"
              active={appliedView === "card"}
              onClick={() => setPreferredView("card")}
            />
            <ActionIconDisplay
              icon="table"
              label="Table"
              active={appliedView === "table"}
              onClick={() => setPreferredView("table")}
            />
          </div>
        </div>
      </div>

      {isFiltersOpen ? (
        <div className="data-toolbar">
          <div className="data-toolbar__search">
            <input
              type="search"
              placeholder={`Search ${title}`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="data-toolbar__filters">
            {filterConfigs.map((filter) => (
              <MultiSelectFilter
                key={filter.key}
                label={filter.label}
                options={filter.options}
                selectedValues={activeFilters[filter.key] || []}
                onChange={(values) =>
                  setActiveFilters((current) => ({
                    ...current,
                    [filter.key]: values
                  }))
                }
              />
            ))}
            {filterConfigs.length > 0 ? (
              <div className="data-toolbar__clear">
                <button
                  type="button"
                  className="clear-filters-button"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="table-state">{loadingMessage}</div>
      ) : error ? (
        <p className="feedback feedback--error">{error}</p>
      ) : appliedView === "table" ? (
        <div className="table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>Sl.No.</th>
                {columns.map((col) => (
                  <th key={col.key} onClick={() => handleSort(col.key)} style={{ cursor: "pointer" }}>
                    {col.label}
                    {sortConfig?.key === col.key ? (
                      <span>{sortConfig.direction === "asc" ? " ^" : " v"}</span>
                    ) : null}
                  </th>
                ))}
                {renderActions ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (renderActions ? 2 : 1)} className="table-state">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedRecords.map((record, index) => (
                  <tr key={record[rowKey] ?? index}>
                    <td>{index + 1}</td>
                    {columns.map((col) => (
                      <td key={col.key} className={col.highlight ? "text-blue" : undefined}>
                        {formatCellValue(getRecordValue(record, col.key))}
                      </td>
                    ))}
                    {renderActions ? (
                      <td>
                        <div className="table-actions">{renderActions(record)}</div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : sortedRecords.length === 0 ? (
        <div className="table-state">{emptyMessage}</div>
      ) : (
        <div className="record-cards">
          {sortedRecords.map((record, index) => (
            <article className="record-card" key={record[rowKey] ?? index}>
              <div className="record-card__header">
                <div>
                  <p className="record-card__eyebrow">#{index + 1}</p>
                  <h3>{cardTitle ? cardTitle(record) : formatCellValue(getRecordValue(record, columns[0].key))}</h3>
                  {cardSubtitle ? <p className="record-card__subtitle">{cardSubtitle(record)}</p> : null}
                </div>
              </div>

              <div className="record-card__body">
                {visibleCardFields.map((field) => (
                  <div className="record-card__field" key={field.key}>
                    <span>{field.label}</span>
                    <strong className={field.highlight ? "text-blue" : undefined}>
                      {formatCellValue(getRecordValue(record, field.key))}
                    </strong>
                  </div>
                ))}
              </div>

              {renderActions ? <div className="record-card__actions">{renderActions(record)}</div> : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
