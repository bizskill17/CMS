import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { ActionIconButton } from "./ActionIcon";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { ButtonSpinner } from "./Spinner";
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

const columns = [
  { key: "policy_number", label: "Policy No." },
  { key: "customer_name", label: "Customer", highlight: true },
  { key: "customer_group_name", label: "Group Name", highlight: true },
  { key: "company_name", label: "Insurance Company", highlight: true },
  { key: "product_name", label: "Product Name", highlight: true },
  { key: "policy_type", label: "Policy Type" },
  { key: "issue_date", label: "Issue Date" },
  { key: "risk_end_date", label: "Risk Expiry Date" }
];

export default function AttachDocumentsPage() {
  const [records, setRecords] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formState, setFormState] = useState({
    document_type_id: "",
    document_number: "",
    document_date: "",
    expiry_date: "",
    remarks: "",
    file: null
  });

  const policyDocumentTypes = documentTypes.filter(
    (documentType) => String(documentType.entity_level || "").toLowerCase() === "policy"
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [policiesResponse, documentTypesResponse] = await Promise.all([
          fetch(`${API_BASE}/policies/pending-documents?limit=100`),
          fetch(`${API_BASE}/masters/document-types?limit=250`)
        ]);
        const [policiesJson, documentTypesJson] = await Promise.all([
          readApiJson(policiesResponse),
          readApiJson(documentTypesResponse)
        ]);

        if (!policiesResponse.ok) {
          throw new Error(policiesJson.message || "Failed to load pending document policies.");
        }

        if (!documentTypesResponse.ok) {
          throw new Error(documentTypesJson.message || "Failed to load document types.");
        }

        setRecords(policiesJson.data || []);
        setDocumentTypes(documentTypesJson.data || []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const resetModal = () => {
    setIsModalOpen(false);
    setSelectedPolicy(null);
    setFormState({
      document_type_id: "",
      document_number: "",
      document_date: "",
      expiry_date: "",
      remarks: "",
      file: null
    });
  };

  const handleOpenUpload = (policy) => {
    setSelectedPolicy(policy);
    setMessage("");
    setError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedPolicy) {
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const payload = new FormData();
      payload.append("policy_id", String(selectedPolicy.id));
      payload.append("document_type_id", formState.document_type_id);
      payload.append("document_number", formState.document_number);
      payload.append("document_date", formState.document_date);
      payload.append("expiry_date", formState.expiry_date);
      payload.append("remarks", formState.remarks);

      if (formState.file) {
        payload.append("file", formState.file);
      }

      const response = await fetch(`${API_BASE}/policies/upload-document`, {
        method: "POST",
        body: payload
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to upload document.");
      }

      setMessage(json.message || "Document uploaded successfully.");
      setRecords((current) => current.filter((record) => record.id !== selectedPolicy.id));
      resetModal();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

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
          title="Pending Document Uploads"
          records={records}
          columns={columns}
          loading={loading}
          error={error && !isModalOpen ? error : ""}
          loadingMessage="Loading pending policies..."
          emptyMessage="No policies are pending document upload."
          searchKeys={[
            "policy_number",
            "customer_name",
            "customer_group_name",
            "company_name",
            "product_name",
            "policy_type"
          ]}
          filterConfigs={filterConfigs}
          renderActions={(record) => (
            <ActionIconButton
              icon="upload"
              label="Upload Document"
              onClick={() => handleOpenUpload(record)}
            />
          )}
          cardTitle={(record) => record.policy_number || "Policy"}
          cardSubtitle={(record) => `${record.customer_name || "-"} • ${record.company_name || "-"}`}
          cardFields={[
            { key: "customer_group_name", label: "Group", highlight: true },
            { key: "product_name", label: "Product", highlight: true },
            { key: "policy_type", label: "Policy Type" },
            { key: "issue_date", label: "Issue Date" },
            { key: "risk_end_date", label: "Risk Expiry Date" }
          ]}
        />

        {message ? <p className="feedback feedback--success">{message}</p> : null}
      </section>

      {isModalOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="upload-document-title">
          <div className="master-modal__backdrop" onClick={resetModal} />
          <section className="master-card master-modal__panel">
            <div className="master-card__header">
              <h3 id="upload-document-title">Upload Document</h3>
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
                  <FormLabel required>Document Type</FormLabel>
                  <select
                    value={formState.document_type_id}
                    required
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, document_type_id: event.target.value }))
                    }
                  >
                    <option value="">Select Document Type</option>
                    {policyDocumentTypes.map((documentType) => (
                      <option key={documentType.id} value={documentType.id}>
                        {documentType.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <FormLabel>Document Number</FormLabel>
                  <input
                    type="text"
                    value={formState.document_number}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, document_number: event.target.value }))
                    }
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Document Date</FormLabel>
                  <input
                    type="date"
                    value={formState.document_date}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, document_date: event.target.value }))
                    }
                  />
                </label>

                <label className="form-field">
                  <FormLabel>Expiry Date</FormLabel>
                  <input
                    type="date"
                    value={formState.expiry_date}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, expiry_date: event.target.value }))
                    }
                  />
                </label>

                <label className="form-field">
                  <FormLabel required>Choose File</FormLabel>
                  <input
                    type="file"
                    required
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, file: event.target.files?.[0] || null }))
                    }
                  />
                </label>

                <label className="form-field issue-policy-form__wide">
                  <FormLabel>Remarks</FormLabel>
                  <textarea
                    rows="3"
                    value={formState.remarks}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, remarks: event.target.value }))
                    }
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={uploading}>
                    {uploading ? <ButtonSpinner label="Uploading..." /> : "Upload Document"}
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
