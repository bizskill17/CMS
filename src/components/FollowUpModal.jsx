import { useEffect, useState } from "react";
import FormLabel from "./FormLabel";
import { ButtonSpinner } from "./Spinner";

const initialFormState = {
  follow_up_date: "",
  follow_up_by: "",
  follow_up_remarks: "",
  follow_up_mode: "",
  next_follow_up_date: "",
  status: ""
};

const modeOptions = ["Call", "WhatsApp", "Email", "Visit", "SMS", "Other"];
const defaultStatusOptions = ["Pending", "Done", "Interested", "Not Interested", "No Response", "Converted"];
const renewalStatusOptions = ["Follow Up Again", "Inactive"];
const paymentStatusOptions = ["Follow Up Again"];

export default function FollowUpModal({
  isOpen,
  title = "Follow Up Form",
  policy,
  policyType,
  users = [],
  statusOptions,
  saving = false,
  error = "",
  onClose,
  onSubmit
}) {
  const [formState, setFormState] = useState(initialFormState);
  const resolvedStatusOptions =
    statusOptions ||
    (policyType === "Renewal"
      ? renewalStatusOptions
      : policyType === "Payment"
        ? paymentStatusOptions
        : defaultStatusOptions);

  useEffect(() => {
    if (!isOpen) {
      setFormState(initialFormState);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    setFormState({
      ...initialFormState,
      follow_up_date: today,
      status: resolvedStatusOptions[0] || ""
    });
  }, [isOpen, policy?.id, resolvedStatusOptions]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (name, value) => {
    setFormState((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.({
      policy_id: policy?.id,
      follow_up_type: policyType,
      ...formState
    });
  };

  return (
    <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="follow-up-title">
      <div className="master-modal__backdrop" onClick={onClose} />
      <section className="master-card master-modal__panel">
        <div className="master-card__header">
          <h3 id="follow-up-title">{title}</h3>
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="master-modal__body">
          <form className="master-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <FormLabel>Policy No.</FormLabel>
              <input type="text" readOnly value={policy?.policy_number || ""} />
            </label>

            <label className="form-field">
              <FormLabel>Customer</FormLabel>
              <input type="text" readOnly value={policy?.customer_name || ""} />
            </label>

            {policyType === "Renewal" ? (
              <>
                <label className="form-field">
                  <FormLabel>Product Name</FormLabel>
                  <input type="text" readOnly value={policy?.product_name || ""} />
                </label>

                <label className="form-field">
                  <FormLabel>Policy Type</FormLabel>
                  <input type="text" readOnly value={policy?.policy_type || ""} />
                </label>
              </>
            ) : null}

            {policyType === "Payment" ? (
              <>
                <label className="form-field">
                  <FormLabel>Company</FormLabel>
                  <input type="text" readOnly value={policy?.company_name || ""} />
                </label>

                <label className="form-field">
                  <FormLabel>Policy Type</FormLabel>
                  <input type="text" readOnly value={policy?.policy_type || ""} />
                </label>
              </>
            ) : null}

            <label className="form-field">
              <FormLabel required>Follow Up Date</FormLabel>
              <input
                type="date"
                required
                value={formState.follow_up_date}
                onChange={(event) => handleChange("follow_up_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Follow Up By</FormLabel>
              <select
                required
                value={formState.follow_up_by}
                onChange={(event) => handleChange("follow_up_by", event.target.value)}
              >
                <option value="">Select Follow Up By</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <FormLabel required>Follow Up Mode</FormLabel>
              <select
                required
                value={formState.follow_up_mode}
                onChange={(event) => handleChange("follow_up_mode", event.target.value)}
              >
                <option value="">Select Follow Up Mode</option>
                {modeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <FormLabel>Next Follow Up Date</FormLabel>
              <input
                type="date"
                value={formState.next_follow_up_date}
                onChange={(event) => handleChange("next_follow_up_date", event.target.value)}
              />
            </label>

            <label className="form-field">
              <FormLabel required>Status</FormLabel>
              <select
                required
                value={formState.status}
                onChange={(event) => handleChange("status", event.target.value)}
              >
                {resolvedStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field issue-policy-form__wide">
              <FormLabel required>Follow Up Remarks</FormLabel>
              <textarea
                rows="4"
                required
                value={formState.follow_up_remarks}
                onChange={(event) => handleChange("follow_up_remarks", event.target.value)}
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? <ButtonSpinner label="Saving..." /> : "Save Follow Up"}
              </button>
            </div>
          </form>

          {error ? <p className="feedback feedback--error">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
