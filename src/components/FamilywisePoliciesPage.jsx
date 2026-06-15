import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import ResponsiveDataView from "./ResponsiveDataView";
import { Spinner } from "./Spinner";
import { buildFilterOptions } from "../utils/dataView";
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

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c5.5 0 9.8 4.6 10.9 6-.9 1.4-5.2 6-10.9 6S2.2 12.4 1.1 11C2.2 9.6 6.5 5 12 5Zm0 2C8.5 7 5.4 9.6 3.8 11 5.4 12.4 8.5 15 12 15s6.6-2.6 8.2-4C18.6 9.6 15.5 7 12 7Zm0 1.5A2.5 2.5 0 1 1 9.5 11 2.5 2.5 0 0 1 12 8.5Z" />
    </svg>
  );
}

const columns = [
  { key: "customer_group_name", label: "Family", highlight: true },
  { key: "policy_count", label: "Total Policies" },
  { key: "policy_number", label: "First Policy No." },
  { key: "issue_date", label: "Issue Date" },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "company_name", label: "Insurance Company", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "risk_end_date", label: "Risk End" },
  { key: "policy_status", label: "Status" }
];

export default function FamilywisePoliciesPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [familyModal, setFamilyModal] = useState({
    isOpen: false,
    familyName: "",
    policies: []
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/policies?limit=500`);
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

  const familywiseRecords = useMemo(() => {
    const grouped = new Map();

    records.forEach((record) => {
      const familyName = String(record.customer_group_name || "No Family").trim() || "No Family";
      const current = grouped.get(familyName);

      if (!current) {
        grouped.set(familyName, {
          ...record,
          customer_group_name: familyName,
          family_key: familyName,
          policy_count: 1,
          related_policies: [record]
        });
        return;
      }

      current.policy_count += 1;
      current.related_policies.push(record);
    });

    return Array.from(grouped.values()).sort((a, b) =>
      String(a.customer_group_name || "").localeCompare(String(b.customer_group_name || ""))
    );
  }, [records]);

  const filterConfigs = useMemo(
    () => [
      {
        key: "customer_group_name",
        label: "Family",
        options: buildFilterOptions(familywiseRecords, "customer_group_name")
      },
      {
        key: "company_name",
        label: "Company",
        options: buildFilterOptions(familywiseRecords, "company_name")
      },
      {
        key: "policy_status",
        label: "Status",
        options: buildFilterOptions(familywiseRecords, "policy_status")
      }
    ],
    [familywiseRecords]
  );

  const openFamilyModal = (record) => {
    setFamilyModal({
      isOpen: true,
      familyName: record.customer_group_name || "Family",
      policies: record.related_policies || []
    });
  };

  const closeFamilyModal = () => {
    setFamilyModal({
      isOpen: false,
      familyName: "",
      policies: []
    });
  };

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <ResponsiveDataView
          title="Familywise Policies"
          records={familywiseRecords}
          columns={columns}
          loading={loading}
          error={error}
          loadingMessage="Loading familywise policies..."
          emptyMessage="No familywise policies found."
          searchKeys={[
            "customer_group_name",
            "customer_name",
            "policy_number",
            "company_name",
            "product_name",
            "policy_type"
          ]}
          filterConfigs={filterConfigs}
          rowKey="family_key"
          renderActions={(record) => (
            <button
              type="button"
              className="icon-button icon-button--view"
              onClick={() => openFamilyModal(record)}
              aria-label="View family policies"
              title="View family policies"
            >
              <ViewIcon />
            </button>
          )}
        />
      </section>

      {familyModal.isOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="family-policies-title">
          <div className="master-modal__backdrop" onClick={closeFamilyModal} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="family-policies-title">Related Policies - {familyModal.familyName}</h3>
              <button type="button" className="text-button" onClick={closeFamilyModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              {loading ? (
                <div className="table-state">
                  <Spinner label="Loading related policies..." />
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="master-table">
                    <thead>
                      <tr>
                        <th>Policy No.</th>
                        <th>Issue Date</th>
                        <th>Customer</th>
                        <th>Company</th>
                        <th>Product</th>
                        <th>Policy Type</th>
                        <th>Business Type</th>
                        <th>Risk End</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {familyModal.policies.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="table-state">
                            No related policies found for this family.
                          </td>
                        </tr>
                      ) : (
                        familyModal.policies.map((policy) => (
                          <tr key={policy.id}>
                            <td>{formatCellValue(policy.policy_number)}</td>
                            <td>{formatCellValue(policy.issue_date)}</td>
                            <td className="text-blue">{formatCellValue(policy.customer_name)}</td>
                            <td className="text-blue">{formatCellValue(policy.company_name)}</td>
                            <td className="text-blue">{formatCellValue(policy.product_name)}</td>
                            <td>{formatCellValue(policy.policy_type)}</td>
                            <td>{formatCellValue(policy.business_type)}</td>
                            <td>{formatCellValue(policy.risk_end_date)}</td>
                            <td>{formatCellValue(policy.policy_status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
