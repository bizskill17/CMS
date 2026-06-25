import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import ResponsiveDataView from "./ResponsiveDataView";
import { ActionIconButton } from "./ActionIcon";
import { buildFilterOptions } from "../utils/dataView";
import FormLabel from "./FormLabel";

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

const columns = [
  { key: "policy_number", label: "Policy No." },
  { key: "issue_date", label: "Issue Date" },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_group_name", label: "Customer Group", highlight: true },
  { key: "company_name", label: "Insurance Company", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "business_type", label: "Business Type" },
  { key: "gross_premium", label: "Gross Premium" },
  { key: "net_premium", label: "Net Premium" },
  { key: "risk_start_date", label: "Risk Start" },
  { key: "risk_end_date", label: "Risk End" },
  { key: "paid_by_type", label: "Payment By" },
  { key: "payment_mode", label: "Payment Mode" },
  { key: "policy_status", label: "Status" }
];

export default function AllPoliciesPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issueDateFrom, setIssueDateFrom] = useState("");
  const [issueDateTo, setIssueDateTo] = useState("");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");


  const loadRecords = async () => {
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
  useEffect(() => {
    loadRecords();
  }, []);

  const dateFilteredRecords = useMemo(() => {
    return records.filter((record) => {
      const issueDate = String(record.issue_date || "").slice(0, 10);
      const expiryDate = String(record.risk_end_date || "").slice(0, 10);

      if (issueDateFrom && issueDate < issueDateFrom) return false;
      if (issueDateTo && issueDate > issueDateTo) return false;
      if (expiryDateFrom && expiryDate < expiryDateFrom) return false;
      if (expiryDateTo && expiryDate > expiryDateTo) return false;

      return true;
    });
  }, [records, issueDateFrom, issueDateTo, expiryDateFrom, expiryDateTo]);

  const deletePolicy = async (policy) => {
    if (!window.confirm(`Are you sure you want to delete policy "${policy.policy_number}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/policies/${policy.id}`, {
        method: "DELETE"
      });

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to delete policy.");
      }

      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (deleteError) {
      alert(deleteError.message);
    }
  };

  const renderPolicyActions = (policy) => (
    <ActionIconButton icon="delete" label="Delete Policy" tone="danger" onClick={() => deletePolicy(policy)} />
  );

  const filterConfigs = useMemo(
    () => [
      { key: "customer_name", label: "Customer", options: buildFilterOptions(records, "customer_name") },
      { key: "customer_group_name", label: "Group", options: buildFilterOptions(records, "customer_group_name") },
      { key: "company_name", label: "Company", options: buildFilterOptions(records, "company_name") },
      { key: "policy_type", label: "Policy Type", options: buildFilterOptions(records, "policy_type") },
      { key: "business_type", label: "Business Type", options: buildFilterOptions(records, "business_type") },
      { key: "policy_status", label: "Status", options: buildFilterOptions(records, "policy_status") },
      { key: "paid_by_type", label: "Payment By", options: buildFilterOptions(records, "paid_by_type") }
    ],
    [records]
  );

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <ResponsiveDataView
          title="All Policies"
          records={dateFilteredRecords}
          columns={columns}
          loading={loading}
          error={error}
          loadingMessage="Loading policies..."
          emptyMessage="No policies found."
          searchKeys={[
            "policy_number",
            "customer_name",
            "customer_group_name",
            "company_name",
            "product_name",
            "policy_type",
            "registration_no"
          ]}
          filterConfigs={filterConfigs}
          customFilterContent={
            <>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Issue Date From</FormLabel>
                <input
                  type="date"
                  value={issueDateFrom}
                  onChange={(event) => setIssueDateFrom(event.target.value)}
                />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Issue Date To</FormLabel>
                <input
                  type="date"
                  value={issueDateTo}
                  onChange={(event) => setIssueDateTo(event.target.value)}
                />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Expiry Date From</FormLabel>
                <input
                  type="date"
                  value={expiryDateFrom}
                  onChange={(event) => setExpiryDateFrom(event.target.value)}
                />
              </label>
              <label className="form-field data-toolbar__date-field">
                <FormLabel>Expiry Date To</FormLabel>
                <input
                  type="date"
                  value={expiryDateTo}
                  onChange={(event) => setExpiryDateTo(event.target.value)}
                />
              </label>
            </>
          }
          onClearCustomFilters={() => {
            setIssueDateFrom("");
            setIssueDateTo("");
            setExpiryDateFrom("");
            setExpiryDateTo("");
          }}
          renderActions={renderPolicyActions}
        />
      </section>
    </div>
  );
}

