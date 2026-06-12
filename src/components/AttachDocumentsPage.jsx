import { useEffect, useState } from "react";
import { API_BASE } from "../config/api";
import { formatCellValue } from "../utils/formatting";
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

  return (
    <div className="page-shell issue-policy-page">
      <div className="page-hero page-hero--masters">
        <h2>Attach Documents</h2>
      </div>

      <section className="master-card issue-policy-card">
        <div className="master-card__header">
          <h3>Policies Pending Document Upload</h3>
          <span>{records.length} records</span>
        </div>

        {loading ? (
          <div className="table-state">Loading pending policies...</div>
        ) : error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : (
          <div className="table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Policy No.</th>
                  <th>Customer</th>
                  <th>Group Name</th>
                  <th>Insurance Company</th>
                  <th>Product Name</th>
                  <th>Policy Type</th>
                  <th>Issue Date</th>
                  <th>Risk Expiry Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="table-state">
                      No policies are pending document upload.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>{formatCellValue(record.policy_number)}</td>
                      <td>{formatCellValue(record.customer_name)}</td>
                      <td>{formatCellValue(record.customer_group_name)}</td>
                      <td>{formatCellValue(record.company_name)}</td>
                      <td>{formatCellValue(record.product_name)}</td>
                      <td>{formatCellValue(record.policy_type)}</td>
                      <td>{formatCellValue(record.issue_date)}</td>
                      <td>{formatCellValue(record.risk_end_date)}</td>
                      <td>Pending Upload</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleOpenUpload(record)}
                        >
                          Upload Document
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
                    {documentTypes.map((documentType) => (
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
                    {uploading ? "Uploading..." : "Upload Document"}
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
