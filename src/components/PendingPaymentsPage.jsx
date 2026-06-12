import { useEffect, useState } from "react";
import { API_BASE } from "../config/api";
import { formatCellValue } from "../utils/formatting";
import FormLabel from "./FormLabel";

const initialFormState = {
  payment_date: "",
  amount: "",
  payment_mode: "",
  payment_status: "Received",
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

export default function PendingPaymentsPage() {
  const [records, setRecords] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE}/payments/pending-client?limit=100`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Failed to load pending payments.");
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

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        <div className="master-card__header">
          <span></span>
          <span>{records.length} records</span>
        </div>

        {loading ? (
          <div className="table-state">Loading pending payments...</div>
        ) : error && !isModalOpen ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <div className="table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Policy No.</th>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Policy Type</th>
                  <th>Issue Date</th>
                  <th>Payment By</th>
                  <th>Net Premium</th>
                  <th>Received</th>
                  <th>Pending</th>
                  <th>Client Payment Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="table-state">
                      No pending payments from clients found.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{formatCellValue(record.policy_number)}</td>
                      <td>{formatCellValue(record.customer_name)}</td>
                      <td>{formatCellValue(record.company_name)}</td>
                      <td>{formatCellValue(record.policy_type)}</td>
                      <td>{formatCellValue(record.issue_date)}</td>
                      <td>{formatCellValue(record.paid_by_type)}</td>
                      <td>{formatCellValue(record.net_premium)}</td>
                      <td>{formatCellValue(record.payment_received_amount)}</td>
                      <td>{formatCellValue(record.payment_pending_amount)}</td>
                      <td>{formatCellValue(record.client_payment_status)}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => openModal(record)}
                        >
                          Update Client Payment
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

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
    </div>
  );
}
