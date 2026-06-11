import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { masterConfigs } from "../data/masterConfigs";

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
  } catch (parseError) {
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

function emptyState(config) {
  return config.fields.reduce((acc, field) => {
    acc[field.name] = field.type === "checkbox" ? true : "";
    return acc;
  }, {});
}

function getOptionLabel(resource, item) {
  if (resource === "customer-groups") return item.group_name;
  if (resource === "insurance-companies") return item.company_name;
  if (resource === "product-categories") return item.category_name;
  if (resource === "agents") return item.full_name;
  return item.name ?? item.label ?? item.id;
}

export default function MasterPage({ resourceKey }) {
  const config = masterConfigs[resourceKey];
  const [records, setRecords] = useState([]);
  const [optionsMap, setOptionsMap] = useState({});
  const [formState, setFormState] = useState(() => emptyState(config));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dependencies = useMemo(
    () =>
      [...new Set(config.fields.filter((field) => field.optionsFrom).map((field) => field.optionsFrom))],
    [config.fields]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [recordResponse, ...optionResponses] = await Promise.all([
          fetch(`${API_BASE}/masters/${config.resource}?limit=100`),
          ...dependencies.map((dependency) => fetch(`${API_BASE}/masters/${dependency}?limit=250`))
        ]);

        const recordJson = await readApiJson(recordResponse);
        if (!recordResponse.ok) {
          throw new Error(recordJson.message || "Failed to load records.");
        }

        const optionEntries = await Promise.all(
          optionResponses.map(async (response, index) => {
            const json = await readApiJson(response);
            if (!response.ok) {
              throw new Error(json.message || "Failed to load lookup data.");
            }
            return [dependencies[index], json.data];
          })
        );

        setRecords(recordJson.data);
        setOptionsMap(Object.fromEntries(optionEntries));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [config.resource, dependencies]);

  const resetForm = () => {
    setFormState(emptyState(config));
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleAdd = () => {
    setFormState(emptyState(config));
    setEditingId(null);
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const handleChange = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field.name]: field.type === "checkbox" ? Boolean(value) : value
    }));
  };

  const handleEdit = (record) => {
    const nextState = emptyState(config);
    for (const field of config.fields) {
      nextState[field.name] =
        field.type === "checkbox"
          ? Boolean(record[field.name])
          : record[field.name] ?? "";
    }
    setFormState(nextState);
    setEditingId(record.id);
    setMessage("");
    setError("");
    setIsFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId
        ? `${API_BASE}/masters/${config.resource}/${editingId}`
        : `${API_BASE}/masters/${config.resource}`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formState)
      });

      const json = await readApiJson(response);
      if (!response.ok) {
        throw new Error(json.message || "Save failed.");
      }

      setMessage(json.message || "Saved successfully.");
      resetForm();

      const refresh = await fetch(`${API_BASE}/masters/${config.resource}?limit=100`);
      const refreshJson = await readApiJson(refresh);
      if (!refresh.ok) {
        throw new Error(refreshJson.message || "Refresh failed.");
      }
      setRecords(refreshJson.data);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="master-page">
      <div className="page-hero page-hero--masters">
        <p>Masters</p>
        <h2>{config.title}</h2>
        <span>Create and maintain your foundational setup data here.</span>
      </div>

      <div className={`master-grid${isFormOpen ? "" : " master-grid--list-only"}`}>
        {isFormOpen ? (
          <section className="master-card">
            <div className="master-card__header">
              <h3>{editingId ? `Edit ${config.title}` : `Add ${config.title}`}</h3>
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            </div>

            <form className="master-form" onSubmit={handleSubmit}>
              {config.fields.map((field) => {
                if (field.type === "checkbox") {
                  return (
                    <label key={field.name} className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={Boolean(formState[field.name])}
                        onChange={(event) => handleChange(field, event.target.checked)}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <label key={field.name} className="form-field">
                      <span>{field.label}</span>
                      <textarea
                        value={formState[field.name]}
                        onChange={(event) => handleChange(field, event.target.value)}
                        rows="3"
                      />
                    </label>
                  );
                }

                if (field.type === "select") {
                  const dynamicOptions = field.optionsFrom
                    ? optionsMap[field.optionsFrom] || []
                    : field.staticOptions || [];

                  return (
                    <label key={field.name} className="form-field">
                      <span>{field.label}</span>
                      <select
                        value={formState[field.name]}
                        onChange={(event) => handleChange(field, event.target.value)}
                      >
                        {!field.staticOptions ? <option value="">Select {field.label}</option> : null}
                        {field.staticOptions
                          ? field.staticOptions.map((option) => (
                              <option key={`${field.name}-${option.value}`} value={option.value}>
                                {option.label}
                              </option>
                            ))
                          : dynamicOptions.map((option) => (
                              <option key={`${field.name}-${option.id}`} value={option.id}>
                                {getOptionLabel(field.optionsFrom, option)}
                              </option>
                            ))}
                      </select>
                    </label>
                  );
                }

                return (
                  <label key={field.name} className="form-field">
                    <span>{field.label}</span>
                    <input
                      type={field.type || "text"}
                      value={formState[field.name]}
                      required={Boolean(field.required)}
                      onChange={(event) => handleChange(field, event.target.value)}
                    />
                  </label>
                );
              })}

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update Record" : "Save Record"}
                </button>
              </div>
            </form>

            {message ? <p className="feedback feedback--success">{message}</p> : null}
            {error ? <p className="feedback feedback--error">{error}</p> : null}
          </section>
        ) : null}

        <section className="master-card master-card--table">
          <div className="master-card__header">
            <h3>{config.title} List</h3>
            <div className="master-card__actions">
              <span>{records.length} records</span>
              <button type="button" className="primary-button" onClick={handleAdd}>
                + Add
              </button>
            </div>
          </div>

          {loading ? (
            <div className="table-state">Loading records...</div>
          ) : (
            <div className="table-wrap">
              <table className="master-table">
                <thead>
                  <tr>
                    {config.tableColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={config.tableColumns.length + 1} className="table-state">
                        No records yet.
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id}>
                        {config.tableColumns.map((column) => (
                          <td key={`${record.id}-${column.key}`}>
                            {column.type === "boolean"
                              ? record[column.key]
                                ? "Yes"
                                : "No"
                              : record[column.key] || "-"}
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleEdit(record)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
