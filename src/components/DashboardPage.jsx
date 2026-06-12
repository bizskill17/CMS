import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";

const dashboardItems = [
  {
    key: "renewals_next_7_days",
    label: "Policies Pending for Renewal in next 7 days",
    tone: "warning",
    icon: "renewalSoon"
  },
  {
    key: "pending_document_uploads",
    label: "Policies Pending for Document Upload",
    tone: "info",
    icon: "documents"
  },
  {
    key: "renewals_overdue",
    label: "Renewals Pending beyond due date",
    tone: "danger",
    icon: "renewalOverdue"
  },
  {
    key: "pending_client_collections",
    label: "Pending for Payment Collection from Client",
    tone: "success",
    icon: "payments"
  }
];

function DashboardIcon({ name }) {
  const icons = {
    renewalSoon: (
      <>
        <path d="M8 3h2v2h4V3h2v2h2a2 2 0 0 1 2 2v3H4V7a2 2 0 0 1 2-2h2V3Zm12 9v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6h16ZM7 14h3v3H7v-3Zm5 0h3v3h-3v-3Z" />
        <path d="M19.5 15a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm-.75 2v2.19l1.72 1.72 1.06-1.06-1.28-1.28V17h-1.5Z" />
      </>
    ),
    documents: (
      <>
        <path d="M7 2h8l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 2v4h4" />
        <path d="M9 11h6v2H9v-2Zm0 4h6v2H9v-2Z" />
        <path d="M18 15v3h3v2h-3v3h-2v-3h-3v-2h3v-3h2Z" />
      </>
    ),
    renewalOverdue: (
      <>
        <path d="M8 3h2v2h4V3h2v2h2a2 2 0 0 1 2 2v3H4V7a2 2 0 0 1 2-2h2V3Zm12 9v5a2 2 0 0 1-2 2h-5V12h7ZM4 12h7v7H6a2 2 0 0 1-2-2v-5Z" />
        <path d="M17.5 14a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm-.9 2.1h1.8l-.2 3.2h-1.4l-.2-3.2Zm.9 5.8a1.05 1.05 0 1 0 0-2.1 1.05 1.05 0 0 0 0 2.1Z" />
      </>
    ),
    payments: (
      <>
        <path d="M4 13c0-1.1.9-2 2-2h4.8c.8 0 1.6.3 2.2.9l1.1 1.1H18a2 2 0 0 1 0 4h-4.8a3.7 3.7 0 0 1-2.6-1.1l-.9-.9H8v5H4v-7Z" />
        <path d="M15.5 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm-.7 1.4v1h-1v1.3h1v1.9h1.4V6.7h1c.9 0 1.6-.7 1.6-1.6s-.7-1.5-1.6-1.5h-2.4Z" />
      </>
    )
  };

  return (
    <span className={`dashboard-table__icon dashboard-table__icon--${name}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {icons[name]}
      </svg>
    </span>
  );
}

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

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    renewals_next_7_days: 0,
    pending_document_uploads: 0,
    renewals_overdue: 0,
    pending_client_collections: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/dashboard/policy-summary`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load dashboard summary.");
        }

        setSummary({
          renewals_next_7_days: Number(json.data.renewals_next_7_days || 0),
          pending_document_uploads: Number(json.data.pending_document_uploads || 0),
          renewals_overdue: Number(json.data.renewals_overdue || 0),
          pending_client_collections: Number(json.data.pending_client_collections || 0)
        });
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="dashboard-page">
      <section className="master-card dashboard-card">
        <div className="master-card__header">
          <span></span>
          <span>{dashboardItems.length} dashboard items</span>
        </div>

        {loading ? (
          <div className="table-state">Loading dashboard...</div>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <div className="table-wrap">
            <table className="master-table dashboard-table">
              <thead>
                <tr>
                  <th>Sl. No.</th>
                  <th>Policy Dashboard Item</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {dashboardItems.map((item, index) => (
                  <tr key={item.key}>
                    <td className="dashboard-table__serial">{index + 1}</td>
                    <td>
                      <div className="dashboard-table__item">
                        <DashboardIcon name={item.icon} />
                        <span>{item.label}</span>
                      </div>
                    </td>
                    <td className="dashboard-table__count-cell">
                      <span className={`dashboard-table__count dashboard-table__count--${item.tone}`}>
                        {summary[item.key]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
