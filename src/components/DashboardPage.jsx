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

const pendingLeadItems = [
  {
    key: "leads-pending-assigning",
    label: "Pending Assigning",
    tone: "warning",
    path: "/leads/pending-assigning"
  },
  {
    key: "leads-pending-first-follow-up",
    label: "Pending First Follow Up",
    tone: "info",
    path: "/leads/pending-first-follow-up"
  },
  {
    key: "leads-pending-repeat-follow-up",
    label: "Pending Repeat Follow Up",
    tone: "danger",
    path: "/leads/pending-repeat-follow-up"
  }
];

const pendingTaskItems = [
  {
    key: "tasks-pending",
    label: "Pending Tasks",
    tone: "success",
    path: "/tasks/pending"
  },
  {
    key: "tasks-completed",
    label: "Completed Tasks",
    tone: "info",
    path: "/tasks/completed"
  },
  {
    key: "tasks-canceled",
    label: "Canceled Tasks",
    tone: "danger",
    path: "/tasks/canceled"
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
  const [menuCounts, setMenuCounts] = useState({
    "leads-pending-assigning": 0,
    "leads-pending-first-follow-up": 0,
    "leads-pending-repeat-follow-up": 0,
    "tasks-pending": 0,
    "tasks-completed": 0,
    "tasks-canceled": 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [summaryResponse, countsResponse] = await Promise.all([
          fetch(`${API_BASE}/dashboard/policy-summary`),
          fetch(`${API_BASE}/menu/counts`)
        ]);
        const [summaryJson, countsJson] = await Promise.all([
          readApiJson(summaryResponse),
          readApiJson(countsResponse)
        ]);

        if (!summaryResponse.ok) {
          throw new Error(summaryJson.message || "Failed to load dashboard summary.");
        }

        setSummary({
          renewals_next_7_days: Number(summaryJson.data.renewals_next_7_days || 0),
          pending_document_uploads: Number(summaryJson.data.pending_document_uploads || 0),
          renewals_overdue: Number(summaryJson.data.renewals_overdue || 0),
          pending_client_collections: Number(summaryJson.data.pending_client_collections || 0)
        });

        if (!countsResponse.ok) {
          throw new Error(countsJson.message || "Failed to load menu counts.");
        }

        setMenuCounts({
          "leads-pending-assigning": Number(countsJson.data["leads-pending-assigning"] || 0),
          "leads-pending-first-follow-up": Number(countsJson.data["leads-pending-first-follow-up"] || 0),
          "leads-pending-repeat-follow-up": Number(countsJson.data["leads-pending-repeat-follow-up"] || 0),
          "tasks-pending": Number(countsJson.data["tasks-pending"] || 0),
          "tasks-completed": Number(countsJson.data["tasks-completed"] || 0),
          "tasks-canceled": Number(countsJson.data["tasks-canceled"] || 0)
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
          <h3 className="responsive-data-view__title">Pending Insurance Tasks</h3>
          <div className="master-card__actions master-card__actions--header"></div>
        </div>

        {loading ? (
          <div className="table-state">
            <Spinner label="Loading dashboard..." />
          </div>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <>
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

            <div className="dashboard-section">
              <div className="master-card__header">
                <h3 className="responsive-data-view__title">Pending Leads</h3>
              </div>
              <div className="dashboard-list">
                {pendingLeadItems.map((item) => (
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
                        {menuCounts[item.key]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-section">
              <div className="master-card__header">
                <h3 className="responsive-data-view__title">Pending Tasks</h3>
              </div>
              <div className="dashboard-list">
                {pendingTaskItems.map((item) => (
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
                        {menuCounts[item.key]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
