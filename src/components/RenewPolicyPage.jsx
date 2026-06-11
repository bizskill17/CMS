import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { formatDateDisplay } from "../utils/formatting";

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

function sortByLabel(items, key) {
  return [...items].sort((a, b) => String(a[key] || "").localeCompare(String(b[key] || "")));
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

export default function RenewPolicyPage() {
  const [formState, setFormState] = useState(initialFormState);
  const [lookupData, setLookupData] = useState({
    customerGroups: [],
    policies: []
  });
  const [policyQuery, setPolicyQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/policies/renew-form`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load renewal form data.");
        }

        setLookupData({
          customerGroups: sortByLabel(json.data.customerGroups || [], "group_name"),
          policies: sortByLabel(json.data.policies || [], "policy_number")
        });
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredPolicies = useMemo(() => {
    const query = policyQuery.trim().toLowerCase();

    return lookupData.policies.filter((policy) => {
      const matchesGroup =
        !formState.customer_group_id || String(policy.customer_group_id || "") === formState.customer_group_id;
      const matchesQuery =
        !query ||
        String(policy.policy_number || "").toLowerCase().includes(query) ||
        String(policy.customer_name || "").toLowerCase().includes(query) ||
        String(policy.registration_no || "").toLowerCase().includes(query);

      return matchesGroup && matchesQuery;
    });
  }, [formState.customer_group_id, lookupData.policies, policyQuery]);

  const selectedPolicy = useMemo(
    () => lookupData.policies.find((policy) => String(policy.id) === formState.previous_policy_id),
    [formState.previous_policy_id, lookupData.policies]
  );

  useEffect(() => {
    if (!selectedPolicy) {
      return;
    }

    setPolicyQuery(selectedPolicy.policy_number || "");
    setFormState((current) => ({
      ...current,
      customer_group_id: selectedPolicy.customer_group_id ? String(selectedPolicy.customer_group_id) : "",
      customer_id: selectedPolicy.customer_id ? String(selectedPolicy.customer_id) : "",
      business_type: "Renewal",
      policy_type: selectedPolicy.policy_type || "",
      company_id: selectedPolicy.company_id ? String(selectedPolicy.company_id) : "",
      product_id: selectedPolicy.product_id ? String(selectedPolicy.product_id) : "",
      vehicle_make: selectedPolicy.vehicle_make || "",
      vehicle_model: selectedPolicy.vehicle_model || "",
      year_of_manufacture: selectedPolicy.year_of_manufacture || "",
      registration_no: selectedPolicy.registration_no || "",
      sum_insured: selectedPolicy.sum_insured || ""
    }));
  }, [selectedPolicy]);

  const handleChange = (name, value) => {
    setFormState((current) => {
      const next = { ...current, [name]: value };

      if (name === "customer_group_id" && current.customer_group_id !== value) {
        next.previous_policy_id = "";
        next.customer_id = "";
        setPolicyQuery("");
      }

      return next;
    });
  };

  const resetForm = () => {
    setFormState(initialFormState);
    setPolicyQuery("");
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
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell issue-policy-page">
      <div className="page-hero page-hero--masters">
        <p>Policies</p>
        <h2>Renew Policy</h2>
        <span>Renew an existing policy and carry forward the linked customer and family details.</span>
      </div>

      <section className="master-card issue-policy-card">
        <div className="master-card__header">
          <h3>Renew Policy Form</h3>
        </div>

        {loading ? (
          <div className="table-state">Loading form data...</div>
        ) : (
          <form className="issue-policy-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Group Name</span>
              <select
                value={formState.customer_group_id}
                onChange={(event) => handleChange("customer_group_id", event.target.value)}
              >
                <option value="">Select Group Name</option>
                {lookupData.customerGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Old Policy Details</span>
              <input
                list="renew-policy-options"
                value={policyQuery}
                required
                placeholder="Search old policy number, customer, or registration no."
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPolicyQuery(nextValue);
                  const match = filteredPolicies.find((policy) => policy.policy_number === nextValue);
                  setFormState((current) => ({
                    ...current,
                    previous_policy_id: match ? String(match.id) : ""
                  }));
                }}
              />
              <datalist id="renew-policy-options">
                {filteredPolicies.map((policy) => (
                  <option key={policy.id} value={policy.policy_number}>
                    {`${policy.customer_name || ""} ${policy.registration_no || ""}`.trim()}
                  </option>
                ))}
              </datalist>
            </label>

            <label className="form-field issue-policy-form__wide">
              <span>Policy Holder Detail</span>
              <textarea readOnly rows="2" value={buildPolicyHolderDetail(selectedPolicy)} />
            </label>

            <label className="form-field issue-policy-form__wide">
              <span>Old Policy Details</span>
              <textarea readOnly rows="2" value={buildOldPolicyDetail(selectedPolicy)} />
            </label>

            <label className="form-field">
              <span>New Policy Number</span>
              <input
                type="text"
                value={formState.new_policy_number}
                required
                onChange={(event) => handleChange("new_policy_number", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Gross Premium</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.gross_premium}
                onChange={(event) => handleChange("gross_premium", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Net Premium</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.net_premium}
                onChange={(event) => handleChange("net_premium", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Policy Issued Date</span>
              <input
                type="date"
                value={formState.issue_date}
                onChange={(event) => handleChange("issue_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Risk Inception Date</span>
              <input
                type="date"
                value={formState.risk_start_date}
                onChange={(event) => handleChange("risk_start_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Risk Expiry Date</span>
              <input
                type="date"
                value={formState.risk_end_date}
                onChange={(event) => handleChange("risk_end_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Business Type</span>
              <input type="text" readOnly value={formState.business_type} />
            </label>

            <label className="form-field">
              <span>Sum Insured</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.sum_insured}
                onChange={(event) => handleChange("sum_insured", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Policy Type</span>
              <input type="text" readOnly value={formState.policy_type} />
            </label>

            <label className="form-field">
              <span>Company Name</span>
              <input type="text" readOnly value={selectedPolicy?.company_name || ""} />
            </label>

            <label className="form-field">
              <span>Product Name</span>
              <input type="text" readOnly value={selectedPolicy?.product_name || ""} />
            </label>

            <label className="form-field">
              <span>Vehicle Make</span>
              <input
                type="text"
                value={formState.vehicle_make}
                onChange={(event) => handleChange("vehicle_make", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Vehicle Model</span>
              <input
                type="text"
                value={formState.vehicle_model}
                onChange={(event) => handleChange("vehicle_model", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Year of Manufacture</span>
              <input
                type="number"
                min="1900"
                max="9999"
                step="1"
                value={formState.year_of_manufacture}
                onChange={(event) => handleChange("year_of_manufacture", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Registration No.</span>
              <input
                type="text"
                value={formState.registration_no}
                onChange={(event) => handleChange("registration_no", event.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Payment made by</span>
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
              <span>Payment Mode</span>
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
              <button type="button" className="secondary-button" onClick={resetForm}>
                Reset
              </button>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Saving..." : "Save Renewal"}
              </button>
            </div>
          </form>
        )}

        {message ? <p className="feedback feedback--success">{message}</p> : null}
        {error ? <p className="feedback feedback--error">{error}</p> : null}
      </section>
    </div>
  );
}
