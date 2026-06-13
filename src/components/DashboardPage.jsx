import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "./Spinner";
import { API_BASE } from "../config/api";

const dashboardItems = [
  {
    key: "renewals_next_7_days",
    label: "Policies Pending for Renewal in next 7 days",
    tone: "warning",
    path: "/policies/renew"
  },
  {
    key: "pending_document_uploads",
    label: "Policies Pending for Document Upload",
    tone: "info",
    path: "/policies/attach-documents"
  },
  {
    key: "renewals_overdue",
    label: "Renewals Pending beyond due date",
    tone: "danger",
    path: "/policies/renew"
  },
  {
    key: "pending_client_collections",
    label: "Pending for Payment Collection from Client",
    tone: "success",
    path: "/payments/pending"
  }
];

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
  const navigate = useNavigate();
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
          <div className="master-card__actions master-card__actions--header">
            <span>{dashboardItems.length} dashboard items</span>
          </div>
        </div>

        {loading ? (
          <div className="table-state">
            <Spinner label="Loading dashboard..." />
          </div>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <div className="dashboard-list">
            {dashboardItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="dashboard-tile"
                onClick={() => navigate(item.path)}
              >
                <span className="dashboard-tile__content">
                  <span className="dashboard-table__item">
                    <span className="text-blue">{item.label}</span>
                  </span>
                  <span className={`dashboard-table__count dashboard-table__count--${item.tone}`}>
                    {summary[item.key]}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
