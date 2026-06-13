import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { ActionIconButton } from "./ActionIcon";
import FollowUpModal from "./FollowUpModal";
import { formatDateDisplay } from "../utils/formatting";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { ButtonSpinner } from "./Spinner";
import { buildFilterOptions } from "../utils/dataView";

const initialFormState = {
  customer_group_id: "",
  previous_policy_id: "",
  customer_id: "",
  new_policy_number: "",
  gross_premium: "",
  net_premium: "",
  issue_date: "",
  risk_start_date: "",
  risk_end_date: "",
  business_type: "Renewal",
  sum_insured: "",
  policy_type: "",
  company_id: "",
  product_id: "",
  vehicle_make: "",
  vehicle_model: "",
  year_of_manufacture: "",
  registration_no: "",
  paid_by_type: "",
  payment_mode: ""
};

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

function buildPolicyHolderDetail(policy) {
  if (!policy) return "";

  const parts = [
    policy.customer_name,
    policy.customer_mobile ? `Mobile: ${policy.customer_mobile}` : "",
    policy.customer_group_name ? `Group: ${policy.customer_group_name}` : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function buildOldPolicyDetail(policy) {
  if (!policy) return "";

  const parts = [
    policy.policy_number ? `Policy No: ${policy.policy_number}` : "",
    policy.policy_type ? `Type: ${policy.policy_type}` : "",
    policy.company_name ? `Company: ${policy.company_name}` : "",
    policy.product_name ? `Product: ${policy.product_name}` : "",
    policy.risk_end_date ? `Expiry: ${formatDateDisplay(policy.risk_end_date)}` : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

const columns = [
  { key: "risk_end_date", label: "Expiry Date" },
  { key: "policy_number", label: "Policy No." },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_mobile", label: "Mobile" },
  { key: "customer_group_name", label: "Group", highlight: true },
  { key: "company_name", label: "Company Name", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "registration_no", label: "Registration No." },
  { key: "follow_up_at", label: "Follow Up Date", className: "table-cell--follow-up" },
  { key: "follow_up_by_name", label: "Follow Up By", className: "table-cell--follow-up" },
  { key: "follow_up_mode", label: "Follow Up Mode", className: "table-cell--follow-up" },
  { key: "next_follow_up_at", label: "Next Follow Up Date", className: "table-cell--follow-up" },
  { key: "follow_up_status", label: "Follow Up Status", className: "table-cell--follow-up" },
  { key: "follow_up_remarks", label: "Follow Up Remarks", className: "table-cell--follow-up" }
];

export default function RenewPolicyPage() {
  const [formState, setFormState] = useState(initialFormState);
  const [lookupData, setLookupData] = useState({
    policies: []
  });
  const [users, setUsers] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [followUpError, setFollowUpError] = useState("");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [response, usersResponse] = await Promise.all([
          fetch(`${API_BASE}/policies/renew-form`),
          fetch(`${API_BASE}/masters/users?limit=250`)
        ]);
        const json = await readApiJson(response);
        const usersJson = await readApiJson(usersResponse);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load renewal form data.");
        }
        if (!usersResponse.ok) {
          throw new Error(usersJson.message || "Failed to load users.");
        }

        setLookupData({
          policies: json.data.policies || []
        });
        setUsers(usersJson.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleChange = (name, value) => {
    setFormState((current) => ({
      ...current,
      [name]: value
    }));
  };

  const openRenewForm = (policy) => {
    setSelectedPolicy(policy);
    setFormState({
      customer_group_id: policy.customer_group_id ? String(policy.customer_group_id) : "",
      previous_policy_id: String(policy.id),
      customer_id: policy.customer_id ? String(policy.customer_id) : "",
      new_policy_number: "",
      gross_premium: "",
      net_premium: "",
      issue_date: "",
      risk_start_date: "",
      risk_end_date: "",
      business_type: "Renewal",
      sum_insured: policy.sum_insured || "",
      policy_type: policy.policy_type || "",
      company_id: policy.company_id ? String(policy.company_id) : "",
      product_id: policy.product_id ? String(policy.product_id) : "",
      vehicle_make: policy.vehicle_make || "",
      vehicle_model: policy.vehicle_model || "",
      year_of_manufacture: policy.year_of_manufacture || "",
      registration_no: policy.registration_no || "",
      paid_by_type: "",
      payment_mode: ""
    });
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setFormState(initialFormState);
    setSelectedPolicy(null);
    setIsFormOpen(false);
  };

  const openFollowUpModal = (policy) => {
    setSelectedPolicy(policy);
    setFollowUpError("");
    setMessage("");
    setIsFollowUpOpen(true);
  };

  const closeFollowUpModal = () => {
    setSelectedPolicy(null);
    setIsFollowUpOpen(false);
    setFollowUpError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE}/policies/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formState)
      });

      const json = await readApiJson(response);
      if (!response.ok) {
        throw new Error(json.message || "Failed to renew policy.");
      }

      setMessage(json.message || "Policy renewed successfully.");
      resetForm();
      const refreshResponse = await fetch(`${API_BASE}/policies/renew-form`);
      const refreshJson = await readApiJson(refreshResponse);
      if (!refreshResponse.ok) {
        throw new Error(refreshJson.message || "Failed to refresh renewal list.");
      }
      setLookupData({
        policies: refreshJson.data.policies || []
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFollowUpSubmit = async (payload) => {
    setSavingFollowUp(true);
    setFollowUpError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE}/follow-ups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = await readApiJson(response);
      if (!response.ok) {
        throw new Error(json.message || "Failed to save follow up.");
      }

      setLookupData((current) => ({
        ...current,
        policies: (current.policies || []).map((record) =>
          record.id === payload.policy_id
            ? {
                ...record,
                follow_up_at: json.data?.follow_up_at || record.follow_up_at,
                follow_up_by_name: json.data?.follow_up_by_name || record.follow_up_by_name,
                follow_up_mode: json.data?.follow_up_mode || record.follow_up_mode,
                next_follow_up_at: json.data?.next_follow_up_at || record.next_follow_up_at,
                follow_up_status: json.data?.follow_up_status || record.follow_up_status,
                follow_up_remarks: json.data?.follow_up_remarks || record.follow_up_remarks
              }
            : record
        )
      }));
      setMessage(json.message || "Follow up saved successfully.");
      closeFollowUpModal();
    } catch (saveError) {
      setFollowUpError(saveError.message);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const records = lookupData.policies || [];
  const dateFilteredRecords = useMemo(() => {
    return records.filter((record) => {
      const expiryDate = String(record.risk_end_date || "").slice(0, 10);

      if (!expiryDate) {
        return !expiryDateFrom && !expiryDateTo;
      }

      if (expiryDateFrom && expiryDate < expiryDateFrom) {
        return false;
      }

      if (expiryDateTo && expiryDate > expiryDateTo) {
        return false;
      }

      return true;
    });
  }, [records, expiryDateFrom, expiryDateTo]);

  const filterConfigs = useMemo(
    () => [
      { key: "company_name", label: "Company", options: buildFilterOptions(records, "company_name") },
      { key: "product_name", label: "Product", options: buildFilterOptions(records, "product_name") },
      { key: "policy_type", label: "Policy Type", options: buildFilterOptions(records, "policy_type") },
      { key: "customer_group_name", label: "Group", options: buildFilterOptions(records, "customer_group_name") }
    ],
    [records]
  );

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <ResponsiveDataView
          title="Renew Policy"
          records={dateFilteredRecords}
          columns={columns}
          loading={loading}
          error={error && !isFormOpen ? error : ""}
          loadingMessage="Loading renewal policies..."
          emptyMessage="No policies are currently eligible for renewal."
          searchKeys={[
            "policy_number",
            "customer_name",
            "customer_mobile",
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
            setExpiryDateFrom("");
            setExpiryDateTo("");
          }}
          renderActions={(policy) => (
            <>
              <ActionIconButton icon="followup" label="Followup" onClick={() => openFollowUpModal(policy)} />
              <ActionIconButton
                icon="renew"
                label="Renew"
                tone="primary"
                onClick={() => openRenewForm(policy)}
              />
            </>
          )}
        />

        {message ? <p className="feedback feedback--success">{message}</p> : null}
      </section>

      {isFormOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="renew-policy-title">
          <div className="master-modal__backdrop" onClick={resetForm} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="renew-policy-title">Renew Policy Form</h3>
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <form className="issue-policy-form" onSubmit={handleSubmit}>
                <label className="form-field">
                  <FormLabel>Group Name</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.customer_group_name || ""} />
                </label>

                <label className="form-field issue-policy-form__wide">
                  <FormLabel>Old Policy Details</FormLabel>
                  <textarea readOnly rows="2" value={buildOldPolicyDetail(selectedPolicy)} />
                </label>

                <label className="form-field issue-policy-form__wide">
                  <FormLabel>Policy Holder Detail</FormLabel>
                  <textarea readOnly rows="2" value={buildPolicyHolderDetail(selectedPolicy)} />
                </label>

                <label className="form-field">
                  <FormLabel required>New Policy Number</FormLabel>
                  <input
                    type="text"
                    value={formState.new_policy_number}
                    required
                    onChange={(event) => handleChange("new_policy_number", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Gross Premium</FormLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.gross_premium}
                    onChange={(event) => handleChange("gross_premium", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Net Premium</FormLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.net_premium}
                    onChange={(event) => handleChange("net_premium", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Policy Issued Date</FormLabel>
                  <input
                    type="date"
                    value={formState.issue_date}
                    onChange={(event) => handleChange("issue_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Risk Inception Date</FormLabel>
                  <input
                    type="date"
                    value={formState.risk_start_date}
                    onChange={(event) => handleChange("risk_start_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Risk Expiry Date</FormLabel>
                  <input
                    type="date"
                    value={formState.risk_end_date}
                    onChange={(event) => handleChange("risk_end_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Business Type</FormLabel>
                  <input type="text" readOnly value={formState.business_type} />
                </label>

                <label className="form-field">
                  <FormLabel>Sum Insured</FormLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.sum_insured}
                    onChange={(event) => handleChange("sum_insured", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Policy Type</FormLabel>
                  <input type="text" readOnly value={formState.policy_type} />
                </label>

                <label className="form-field">
                  <FormLabel>Company Name</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.company_name || ""} />
                </label>

                <label className="form-field">
                  <FormLabel>Product Name</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.product_name || ""} />
                </label>

                <label className="form-field">
                  <FormLabel>Vehicle Make</FormLabel>
                  <input type="text" readOnly value={formState.vehicle_make} />
                </label>

                <label className="form-field">
                  <FormLabel>Vehicle Model</FormLabel>
                  <input type="text" readOnly value={formState.vehicle_model} />
                </label>

                <label className="form-field">
                  <FormLabel>Year of Manufacture</FormLabel>
                  <input type="number" readOnly value={formState.year_of_manufacture} />
                </label>

                <label className="form-field">
                  <FormLabel>Registration No.</FormLabel>
                  <input type="text" readOnly value={formState.registration_no} />
                </label>

                <label className="form-field">
                  <FormLabel>Payment made by</FormLabel>
                  <select
                    value={formState.paid_by_type}
                    onChange={(event) => handleChange("paid_by_type", event.target.value)}
                  >
                    <option value="">Select Payment made by</option>
                    <option value="Client">Client</option>
                    <option value="Agent">Agent</option>
                  </select>
                </label>

                <label className="form-field">
                  <FormLabel>Payment Mode</FormLabel>
                  <select
                    value={formState.payment_mode}
                    onChange={(event) => handleChange("payment_mode", event.target.value)}
                  >
                    <option value="">Select Payment Mode</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                    <option value="Cash">Cash</option>
                  </select>
                </label>

                <div className="form-actions issue-policy-form__actions">
                  <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? <ButtonSpinner label="Saving..." /> : "Save Renewal"}
                  </button>
                </div>
              </form>

              {error ? <p className="feedback feedback--error">{error}</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      <FollowUpModal
        isOpen={isFollowUpOpen}
        title="Renewal Follow Up"
        policy={selectedPolicy}
        policyType="Renewal"
        users={users}
        saving={savingFollowUp}
        error={followUpError}
        onClose={closeFollowUpModal}
        onSubmit={handleFollowUpSubmit}
      />
    </div>
  );
}
