import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { reportConfigs } from "../data/reportConfigs";
import { formatCellValue } from "../utils/formatting";

async function readApiJson(response) {
  const rawText = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!rawText.trim()) {
    throw new Error(
      `API returned an empty response (${response.status} ${response.statusText || "Unknown Status"}).`
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const looksLikeHtml =
      contentType.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(rawText);

    if (looksLikeHtml) {
      throw new Error(
        `API endpoint returned HTML instead of JSON (${response.status} ${response.statusText || "Unknown Status"}). Please check the API URL or server rewrite configuration.`
      );
    }

    throw new Error(
      `API returned an unreadable response (${response.status} ${response.statusText || "Unknown Status"}).`
    );
  }
}

export default function ReportsTablePage({ reportKey }) {
  const config = reportConfigs[reportKey];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedRecords = useMemo(() => {
    if (!sortConfig.key) return records;

    return [...records].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const result = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [records, sortConfig]);

  useEffect(() => {
    if (!config) {
      setLoading(false);
      setError("Report configuration not found.");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}${config.endpoint}?limit=100`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load report.");
        }

        setRecords(json.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [config]);

  if (!config) {
    return (
      <div className="page-shell issue-policy-page">
        <section className="master-card issue-policy-card">
          <p className="feedback feedback--error">Report configuration not found.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <div className="master-card__header">
          <span>{config.title}</span>
          <span>{records.length} records</span>
        </div>

        {loading ? (
          <div className="table-state">{config.loadingMessage}</div>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <div className="table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Sl.No.</th>
                  {config.columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{ cursor: "pointer" }}
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span>{sortConfig.direction === "asc" ? " ^" : " v"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={config.columns.length + 1} className="table-state">
                      {config.emptyMessage}
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((record, index) => (
                    <tr key={record.id ?? `${reportKey}-${index}`}>
                      <td>{index + 1}</td>
                      {config.columns.map((col) => (
                        <td key={col.key} className={col.highlight ? "text-blue" : undefined}>
                          {formatCellValue(record[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
