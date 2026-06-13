import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { reportConfigs } from "../data/reportConfigs";
import ResponsiveDataView from "./ResponsiveDataView";
import { buildFilterOptions } from "../utils/dataView";

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

  const filterConfigs = useMemo(() => {
    if (!config) return [];

    return (config.filters || []).map((filter) => ({
      key: filter.key,
      label: filter.label,
      options: buildFilterOptions(records, filter.key)
    }));
  }, [config, records]);

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
        <ResponsiveDataView
          title={config.title}
          records={records}
          columns={config.columns}
          loading={loading}
          error={error}
          loadingMessage={config.loadingMessage}
          emptyMessage={config.emptyMessage}
          searchKeys={config.searchKeys}
          filterConfigs={filterConfigs}
          cardTitle={(record) => record.policy_number || record.customer_name || config.title}
          cardSubtitle={(record) => record.customer_name || record.company_name || ""}
          cardFields={config.cardFields || config.columns.slice(0, 5)}
        />
      </section>
    </div>
  );
}
