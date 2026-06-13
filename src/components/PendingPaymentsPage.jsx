import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { ActionIconButton } from "./ActionIcon";
import FollowUpModal from "./FollowUpModal";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { buildFilterOptions } from "../utils/dataView";

const initialFormState = {
  payment_date: "",
  amount: "",
  payment_mode: "",
  payment_status: "Received",
  agent_account_id: "",
  cheque_number: "",
  cheque_date: "",
  clearing_date: "",
  reference_number: "",
  remarks: ""
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

const columns = [
  { key: "policy_number", label: "Policy No." },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "company_name", label: "Company", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "issue_date", label: "Issue Date" },
  { key: "paid_by_type", label: "Payment By" },
  { key: "net_premium", label: "Net Premium" },
  { key: "payment_received_amount", label: "Received" },
  { key: "payment_pending_amount", label: "Pending" },
  { key: "client_payment_status", label: "Client Payment Status" }
];

export default function PendingPaymentsPage() {
  const [records, setRecords] = useState([]);
  const [agentAccounts, setAgentAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [followUpError, setFollowUpError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [paymentsRes, agentsRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/payments/pending-client?limit=100`),
          fetch(`${API_BASE}/masters/agent-accounts?limit=250`),
          fetch(`${API_BASE}/masters/users?limit=250`)
        ]);

        const paymentsJson = await readApiJson(paymentsRes);
        const agentsJson = await readApiJson(agentsRes);
        const usersJson = await readApiJson(usersRes);

        if (!paymentsRes.ok) {
          throw new Error(paymentsJson.message || "Failed to load pending payments.");
        }
        if (!agentsRes.ok) {
          throw new Error(agentsJson.message || "Failed to load agent accounts.");
        }
        if (!usersRes.ok) {
          throw new Error(usersJson.message || "Failed to load users.");
        }

        setRecords(paymentsJson.data || []);
        setAgentAccounts(agentsJson.data || []);
        setUsers(usersJson.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const resetModal = () => {
    setSelectedPolicy(null);
    setIsModalOpen(false);
    setFormState(initialFormState);
  };

  const openModal = (policy) => {
    setSelectedPolicy(policy);
    setMessage("");
    setError("");
    setFormState({
      ...initialFormState,
      amount: policy.payment_pending_amount || ""
    });
    setIsModalOpen(true);
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

  const handleChange = (name, value) => {
    setFormState((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedPolicy) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE}/payments/client-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          policy_id: selectedPolicy.id,
          ...formState
        })
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to update client payment.");
      }

      setMessage(json.message || "Client payment updated successfully.");
      const updatedPendingAmount = Number(json.data?.payment_pending_amount ?? 0);
      setRecords((current) =>
        updatedPendingAmount <= 0
          ? current.filter((record) => record.id !== selectedPolicy.id)
          : current.map((record) =>
              record.id === selectedPolicy.id
                ? {
                    ...record,
                    payment_received_amount: json.data.payment_received_amount,
                    payment_pending_amount: updatedPendingAmount,
                    client_payment_status: json.data.client_payment_status
                  }
                : record
            )
      );
      resetModal();
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

      setMessage(json.message || "Follow up saved successfully.");
      closeFollowUpModal();
    } catch (saveError) {
      setFollowUpError(saveError.message);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const filterConfigs = useMemo(
    () => [
      { key: "company_name", label: "Company", options: buildFilterOptions(records, "company_name") },
      { key: "policy_type", label: "Policy Type", options: buildFilterOptions(records, "policy_type") },
      {
        key: "client_payment_status",
        label: "Payment Status",
        options: buildFilterOptions(records, "client_payment_status")
      },
      { key: "paid_by_type", label: "Payment By", options: buildFilterOptions(records, "paid_by_type") }
    ],
    [records]
  );

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <ResponsiveDataView
          title="Pending Payments from Clients"
          records={records}
          columns={columns}
          loading={loading}
          error={error && !isModalOpen ? error : ""}
          loadingMessage="Loading pending payments..."
          emptyMessage="No pending payments from clients found."
          searchKeys={["policy_number", "customer_name", "company_name", "policy_type"]}
          filterConfigs={filterConfigs}
          renderActions={(record) => (
            <>
              <ActionIconButton icon="followup" label="Followup" onClick={() => openFollowUpModal(record)} />
              <ActionIconButton
                icon="payment"
                label="Update Client Payment"
                tone="primary"
                onClick={() => openModal(record)}
              />
            </>
          )}
          cardTitle={(record) => record.policy_number || "Policy"}
          cardSubtitle={(record) => `${record.customer_name || "-"} • ${record.company_name || "-"}`}
          cardFields={[
            { key: "policy_type", label: "Policy Type" },
            { key: "net_premium", label: "Net Premium" },
            { key: "payment_received_amount", label: "Received" },
            { key: "payment_pending_amount", label: "Pending" },
            { key: "client_payment_status", label: "Status", highlight: true }
          ]}
        />

        {message ? <p className="feedback feedback--success">{message}</p> : null}
      </section>

      {isModalOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="client-payment-title">
          <div className="master-modal__backdrop" onClick={resetModal} />
          <section className="master-card master-modal__panel">
            <div className="master-card__header">
              <h3 id="client-payment-title">Update Client Payment</h3>
              <button type="button" className="text-button" onClick={resetModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <form className="master-form" onSubmit={handleSubmit}>
                <label className="form-field">
                  <FormLabel>Policy No.</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.policy_number || ""} />
                </label>

                <label className="form-field">
                  <FormLabel>Customer</FormLabel>
                  <input type="text" readOnly value={selectedPolicy?.customer_name || ""} />
                </label>

                <label className="form-field">
                  <FormLabel required>Payment Date</FormLabel>
                  <input
                    type="date"
                    required
                    value={formState.payment_date}
                    onChange={(event) => handleChange("payment_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required>Amount</FormLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formState.amount}
                    onChange={(event) => handleChange("amount", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required>Payment Mode</FormLabel>
                  <select
                    required
                    value={formState.payment_mode}
                    onChange={(event) => handleChange("payment_mode", event.target.value)}
                  >
                    <option value="">Select Payment Mode</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                    <option value="Cash">Cash</option>
                  </select>
                </label>

                <label className="form-field">
                  <FormLabel>Agent Account</FormLabel>
                  <select
                    value={formState.agent_account_id}
                    onChange={(event) => handleChange("agent_account_id", event.target.value)}
                  >
                    <option value="">Select Agent Account</option>
                    {agentAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.agent_name} - {acc.account_label} ({acc.bank_name || "N/A"})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <FormLabel>Payment Status</FormLabel>
                  <select
                    value={formState.payment_status}
                    onChange={(event) => handleChange("payment_status", event.target.value)}
                  >
                    <option value="Received">Received</option>
                    <option value="Pending">Pending</option>
                    <option value="Cleared">Cleared</option>
                  </select>
                </label>

                <label className="form-field">
                  <FormLabel>Cheque Number</FormLabel>
                  <input
                    type="text"
                    value={formState.cheque_number}
                    onChange={(event) => handleChange("cheque_number", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Cheque Date</FormLabel>
                  <input
                    type="date"
                    value={formState.cheque_date}
                    onChange={(event) => handleChange("cheque_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Clearing Date</FormLabel>
                  <input
                    type="date"
                    value={formState.clearing_date}
                    onChange={(event) => handleChange("clearing_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Reference Number</FormLabel>
                  <input
                    type="text"
                    value={formState.reference_number}
                    onChange={(event) => handleChange("reference_number", event.target.value)}
                  />
                </label>

                <label className="form-field issue-policy-form__wide">
                  <FormLabel>Remarks</FormLabel>
                  <textarea
                    rows="3"
                    value={formState.remarks}
                    onChange={(event) => handleChange("remarks", event.target.value)}
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={saving}>
                    {saving ? "Saving..." : "Save Client Payment"}
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
        title="Pending Payment Follow Up"
        policy={selectedPolicy}
        policyType="Payment"
        users={users}
        saving={savingFollowUp}
        error={followUpError}
        onClose={closeFollowUpModal}
        onSubmit={handleFollowUpSubmit}
      />
    </div>
  );
}
