import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { masterConfigs } from "../data/masterConfigs";
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
  if (resource === "states") return item.state_name;
  if (resource === "cities") return item.city_name;
  if (resource === "product-categories") return item.category_name;
  if (resource === "agents") return item.full_name;
  return item.name ?? item.label ?? item.id;
}

function getOptionValue(field, option) {
  return field.optionValueKey ? option[field.optionValueKey] ?? "" : option.id;
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75z" />
      <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42L18.37 3.29a1.003 1.003 0 0 0-1.42 0L15.13 5.1l3.75 3.75z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
    </svg>
  );
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
      ...(field.resetsFields
        ? Object.fromEntries(field.resetsFields.map((fieldName) => [fieldName, ""]))
        : {}),
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

  const handleDelete = async (record) => {
    const label = record.name || record.full_name || record.company_name || record.group_name || record.id;
    const confirmed = window.confirm(`Delete "${label}"?`);

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_BASE}/masters/${config.resource}/${record.id}`, {
        method: "DELETE"
      });
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Delete failed.");
      }

      setRecords((current) => current.filter((item) => item.id !== record.id));
      setMessage(json.message || "Record deleted successfully.");

      if (editingId === record.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <div className="master-page">
      <div className="page-hero page-hero--masters">
        <p>Masters</p>
        <h2>{config.title}</h2>
        <span>Create and maintain your foundational setup data here.</span>
      </div>

      <div className="master-grid master-grid--list-only">
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
                              : formatCellValue(record[column.key])}
                          </td>
                        ))}
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="icon-button icon-button--edit"
                              onClick={() => handleEdit(record)}
                              aria-label="Edit record"
                              title="Edit"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-button--delete"
                              onClick={() => handleDelete(record)}
                              aria-label="Delete record"
                              title="Delete"
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {message ? <p className="feedback feedback--success">{message}</p> : null}
          {error && !isFormOpen ? <p className="feedback feedback--error">{error}</p> : null}
        </section>
      </div>

      {isFormOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="master-form-title">
          <div className="master-modal__backdrop" onClick={resetForm} />
          <section className="master-card master-modal__panel">
            <div className="master-card__header">
              <h3 id="master-form-title">{editingId ? `Edit ${config.title}` : `Add ${config.title}`}</h3>
              <button type="button" className="text-button" onClick={resetForm}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
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
                      ? (optionsMap[field.optionsFrom] || []).filter((option) => {
                          if (!field.dependsOn || !field.dependsOnKey) {
                            return true;
                          }

                          const parentValue = formState[field.dependsOn];
                          if (!parentValue) {
                            return false;
                          }

                          return String(option[field.dependsOnKey] ?? "") === String(parentValue);
                        })
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
                                <option
                                  key={`${field.name}-${field.optionValueKey || "id"}-${getOptionValue(field, option)}`}
                                  value={getOptionValue(field, option)}
                                >
                                  {field.optionLabelKey
                                    ? option[field.optionLabelKey]
                                    : getOptionLabel(field.optionsFrom, option)}
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

              {error ? <p className="feedback feedback--error">{error}</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
