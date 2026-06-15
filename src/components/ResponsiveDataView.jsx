import { useEffect, useMemo, useState } from "react";
import { ActionIconDisplay } from "./ActionIcon";
import MultiSelectFilter from "./MultiSelectFilter";
import { Spinner } from "./Spinner";
import { downloadCsv } from "../utils/export";
import { filterRecords, getRecordValue, sortRecords } from "../utils/dataView";
import { formatCellValue } from "../utils/formatting";

function getColumnWidthStyle(column, fallback = "140px") {
  if (column.width) {
    return {
      width: column.width,
      minWidth: column.width,
      maxWidth: column.width
    };
  }

  const key = String(column.key || "").toLowerCase();
  const label = String(column.label || "").toLowerCase();
  const token = `${key} ${label}`;

  let width = fallback;

  if (token.includes("issue date") || token.includes("expiry date") || token.includes("follow up date")) {
    width = "120px";
  } else if (
    token.includes("policy no") ||
    token.includes("document no") ||
    token.includes("code") ||
    token.includes("mobile")
  ) {
    width = "110px";
  } else if (token.includes("customer group") || token.includes("group")) {
    width = "170px";
  } else if (
    token.includes("insurance company") ||
    token.includes("company")
  ) {
    width = "240px";
  } else if (token.includes("customer") || token.includes("agent")) {
    width = "145px";
  } else if (token.includes("product")) {
    width = "170px";
  } else if (
    token.includes("premium") ||
    token.includes("amount") ||
    token.includes("received") ||
    token.includes("pending")
  ) {
    width = "120px";
  } else if (
    token.includes("status") ||
    token.includes("active") ||
    token.includes("payment by") ||
    token.includes("payment mode") ||
    token.includes("policy type") ||
    token.includes("business type")
  ) {
    width = "110px";
  } else if (token.includes("remarks")) {
    width = "220px";
  }

  return {
    width,
    minWidth: width,
    maxWidth: width
  };
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
  rowKey = "id",
  initialSort = null,
  customFilterContent = null,
  onClearCustomFilters = null
}) {
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

  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current?.key === key && current.direction === "asc") {
        return { key, direction: "desc" };
      }

      return { key, direction: "asc" };
    });
  };

  return (
    <>
      <div className="master-card__header">
        <span className="responsive-data-view__title">{title}</span>
        <div className="master-card__actions master-card__actions--header">
          <div className="master-list-toolbar__search">
            <input
              type="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <span className="hide-mobile">{sortedRecords.length} records</span>
          {filterConfigs.length > 0 ? (
            <ActionIconDisplay
              icon="filter"
              label="Filters"
              active={isFiltersOpen}
              onClick={() => setIsFiltersOpen((current) => !current)}
              variant="toolbar"
            />
          ) : null}
          <ActionIconDisplay
            icon="excel"
            label="Download Excel"
            showLabel
            variant="toolbar"
            onClick={() =>
              downloadCsv({
                title,
                columns,
                records: sortedRecords
              })
            }
          />
        </div>
      </div>

      {isFiltersOpen ? (
        <div className="data-toolbar">
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
            {customFilterContent}
            {filterConfigs.length > 0 || customFilterContent ? (
              <div className="data-toolbar__clear">
                <button
                  type="button"
                  className="clear-filters-button"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
                    onClearCustomFilters?.();
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
        <div className="table-state">
          <Spinner label={loadingMessage} />
        </div>
      ) : error ? (
        <p className="feedback feedback--error">{error}</p>
      ) : (
        <div className="table-wrap">
          <table className="master-table">
            <colgroup>
              <col style={{ width: "72px", minWidth: "72px", maxWidth: "72px" }} />
              {columns.map((col) => (
                <col key={col.key} style={getColumnWidthStyle(col)} />
              ))}
              {renderActions ? (
                <col style={{ width: "150px", minWidth: "150px", maxWidth: "150px" }} />
              ) : null}
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: "72px", minWidth: "72px", maxWidth: "72px" }}>Sl.No.</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{ cursor: "pointer", ...getColumnWidthStyle(col) }}
                  >
                    {col.label}
                    {sortConfig?.key === col.key ? (
                      <span>{sortConfig.direction === "asc" ? " ^" : " v"}</span>
                    ) : null}
                  </th>
                ))}
                {renderActions ? (
                  <th style={{ width: "150px", minWidth: "150px", maxWidth: "150px" }}>Action</th>
                ) : null}
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
                    <td style={{ width: "72px", minWidth: "72px", maxWidth: "72px" }}>{index + 1}</td>
                    {columns.map((col) => {
                      const isName =
                        col.key.toLowerCase().includes("name") ||
                        col.key.toLowerCase().includes("customer") ||
                        col.key.toLowerCase().includes("company") ||
                        col.key.toLowerCase().includes("agent");

                      return (
                        <td
                          key={col.key}
                          style={getColumnWidthStyle(col)}
                          className={[
                            col.highlight || isName ? "text-blue" : "",
                            col.className || ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {formatCellValue(getRecordValue(record, col.key))}
                        </td>
                      );
                    })}
                    {renderActions ? (
                      <td style={{ width: "150px", minWidth: "150px", maxWidth: "150px" }}>
                        <div className="table-actions">{renderActions(record)}</div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
