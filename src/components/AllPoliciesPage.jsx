import { useEffect, useState } from "react";
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
      <div className="page-hero page-hero--masters">
        <h2>All Policies</h2>
      </div>

      <section className="master-card issue-policy-card">
        <div className="master-card__header">
          <h3>Policies List</h3>
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
                  <th>Policy No.</th>
                  <th>Customer</th>
                  <th>Customer Group</th>
                  <th>Insurance Company</th>
                  <th>Product Name</th>
                  <th>Policy Type</th>
                  <th>Business Type</th>
                  <th>Gross Premium</th>
                  <th>Net Premium</th>
                  <th>Issue Date</th>
                  <th>Risk Start</th>
                  <th>Risk End</th>
                  <th>Payment By</th>
                  <th>Payment Mode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="15" className="table-state">
                      No policies found.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{formatCellValue(record.policy_number)}</td>
                      <td>{formatCellValue(record.customer_name)}</td>
                      <td>{formatCellValue(record.customer_group_name)}</td>
                      <td>{formatCellValue(record.company_name)}</td>
                      <td>{formatCellValue(record.product_name)}</td>
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
