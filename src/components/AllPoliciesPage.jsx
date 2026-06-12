import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
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

export default function AllPoliciesPage() {
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
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/policies?limit=100`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load policies.");
        }

        setRecords(json.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <div className="master-card__header">
          <span></span>
          <span>{records.length} records</span>
        </div>

        {loading ? (
          <div className="table-state">Loading policies...</div>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <div className="table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Sl.No.</th>
                  {[
                    { key: "policy_number", label: "Policy No." },
                    { key: "customer_name", label: "Customer" },
                    { key: "customer_group_name", label: "Customer Group" },
                    { key: "company_name", label: "Insurance Company" },
                    { key: "product_name", label: "Product Name" },
                    { key: "policy_type", label: "Policy Type" },
                    { key: "business_type", label: "Business Type" },
                    { key: "gross_premium", label: "Gross Premium" },
                    { key: "net_premium", label: "Net Premium" },
                    { key: "issue_date", label: "Issue Date" },
                    { key: "risk_start_date", label: "Risk Start" },
                    { key: "risk_end_date", label: "Risk End" },
                    { key: "paid_by_type", label: "Payment By" },
                    { key: "payment_mode", label: "Payment Mode" },
                    { key: "policy_status", label: "Status" }
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{ cursor: "pointer" }}
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan="16" className="table-state">
                      No policies found.
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((record, index) => (
                    <tr key={record.id}>
                      <td>{index + 1}</td>
                      <td>{formatCellValue(record.policy_number)}</td>
                      <td className="text-blue">{formatCellValue(record.customer_name)}</td>
                      <td className="text-blue">{formatCellValue(record.customer_group_name)}</td>
                      <td className="text-blue">{formatCellValue(record.company_name)}</td>
                      <td className="text-blue">{formatCellValue(record.product_name)}</td>
                      <td>{formatCellValue(record.policy_type)}</td>
                      <td>{formatCellValue(record.business_type)}</td>
                      <td>{formatCellValue(record.gross_premium)}</td>
                      <td>{formatCellValue(record.net_premium)}</td>
                      <td>{formatCellValue(record.issue_date)}</td>
                      <td>{formatCellValue(record.risk_start_date)}</td>
                      <td>{formatCellValue(record.risk_end_date)}</td>
                      <td>{formatCellValue(record.paid_by_type)}</td>
                      <td>{formatCellValue(record.payment_mode)}</td>
                      <td>{formatCellValue(record.policy_status)}</td>
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
