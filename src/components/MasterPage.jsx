import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import { masterConfigs } from "../data/masterConfigs";
import { buildFilterOptions, filterRecords, sortRecords } from "../utils/dataView";
import { formatCellValue } from "../utils/formatting";
import FormLabel from "./FormLabel";
import MultiSelectFilter from "./MultiSelectFilter";

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

function validateField(field, value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (field.validation?.pattern) {
    const pattern = new RegExp(field.validation.pattern);
    if (!pattern.test(normalizedValue)) {
      return field.validation.message || `Invalid ${field.label}.`;
    }
  }

  return "";
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

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5c5.5 0 9.8 4.6 10.9 6-.9 1.4-5.2 6-10.9 6S2.2 12.4 1.1 11C2.2 9.6 6.5 5 12 5Zm0 2C8.5 7 5.4 9.6 3.8 11 5.4 12.4 8.5 15 12 15s6.6-2.6 8.2-4C18.6 9.6 15.5 7 12 7Zm0 1.5A2.5 2.5 0 1 1 9.5 11 2.5 2.5 0 0 1 12 8.5Z" />
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
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [relatedPoliciesModal, setRelatedPoliciesModal] = useState({
    isOpen: false,
    customer: null,
    policies: [],
    loading: false,
    error: ""
  });

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const dependencies = useMemo(
    () =>
      [...new Set(config.fields.filter((field) => field.optionsFrom).map((field) => field.optionsFrom))],
    [config.fields]
  );

  const filterableColumns = useMemo(
    () =>
      config.tableColumns.filter(
        (column) => column.type !== "boolean" && !["notes", "description"].includes(column.key)
      ),
    [config.tableColumns]
  );

  const filterConfigs = useMemo(
    () =>
      filterableColumns.map((column) => ({
        key: column.key,
        label: column.label,
        options: buildFilterOptions(records, column.key)
      })),
    [filterableColumns, records]
  );

  const searchKeys = useMemo(() => config.tableColumns.map((column) => column.key), [config.tableColumns]);

  useEffect(() => {
    setActiveFilters(Object.fromEntries(filterConfigs.map((filter) => [filter.key, []])));
  }, [filterConfigs]);

  const filteredRecords = useMemo(
    () => filterRecords(records, { searchTerm, searchKeys, activeFilters }),
    [records, searchTerm, searchKeys, activeFilters]
  );

  const sortedRecords = useMemo(
    () => sortRecords(filteredRecords, sortConfig),
    [filteredRecords, sortConfig]
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

        setRecords(recordJson.data || []);
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
    setMessage("");
    setError("");

    for (const field of config.fields) {
      const validationError = validateField(field, formState[field.name]);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSaving(true);

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
      setRecords(refreshJson.data || []);
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

  const resetRelatedPoliciesModal = () => {
    setRelatedPoliciesModal({
      isOpen: false,
      customer: null,
      policies: [],
      loading: false,
      error: ""
    });
  };

  const handleViewRelatedPolicies = async (record) => {
    setRelatedPoliciesModal({
      isOpen: true,
      customer: record,
      policies: [],
      loading: true,
      error: ""
    });

    try {
      const response = await fetch(`${API_BASE}/customers/${record.id}/policies`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load customer policies.");
      }

      setRelatedPoliciesModal({
        isOpen: true,
        customer: json.data.customer || record,
        policies: json.data.policies || [],
        loading: false,
        error: ""
      });
    } catch (loadError) {
      setRelatedPoliciesModal({
        isOpen: true,
        customer: record,
        policies: [],
        loading: false,
        error: loadError.message
      });
    }
  };

  return (
    <div className="master-page">
      <div className="master-grid master-grid--list-only">
        <section className="master-card master-card--table">
          <div className="master-card__header">
            <span></span>
            <div className="master-card__actions">
              <span>{sortedRecords.length} records</span>
              <button type="button" className="primary-button" onClick={handleAdd}>
                + Add
              </button>
            </div>
          </div>

          {loading ? (
            <div className="table-state">Loading records...</div>
          ) : (
            <>
              <div className="data-toolbar">
                <div className="data-toolbar__search">
                  <input
                    type="search"
                    placeholder={`Search ${config.title}`}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>

                <div className="data-toolbar__filters">
                  {filterConfigs.map((filter) => (
                    <MultiSelectFilter
                      key={filter.key}
                      label={filter.label}
                      options={filter.options}
                      selectedValues={activeFilters[filter.key] || []}
                      onChange={(values) =>
                        setActiveFilters((current) => ({
                          ...current,
                          [filter.key]: values
                        }))
                      }
                    />
                  ))}

                  {filterConfigs.length > 0 ? (
                    <div className="data-toolbar__clear">
                      <button
                        type="button"
                        className="clear-filters-button"
                        onClick={() => {
                          setSearchTerm("");
                          setActiveFilters(
                            Object.fromEntries(filterConfigs.map((filter) => [filter.key, []]))
                          );
                        }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="table-wrap">
                <table className="master-table">
                  <thead>
                    <tr>
                      <th>Sl.No.</th>
                      {config.tableColumns.map((column) => (
                        <th
                          key={column.key}
                          onClick={() => handleSort(column.key)}
                          style={{ cursor: "pointer" }}
                        >
                          {column.label}
                          {sortConfig.key === column.key && (
                            <span>{sortConfig.direction === "asc" ? " ^" : " v"}</span>
                          )}
                        </th>
                      ))}
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={config.tableColumns.length + 2} className="table-state">
                          No records yet.
                        </td>
                      </tr>
                    ) : (
                      sortedRecords.map((record, index) => (
                        <tr key={record.id}>
                          <td>{index + 1}</td>
                          {config.tableColumns.map((column) => {
                            const isName =
                              column.key.toLowerCase().includes("name") ||
                              column.key.toLowerCase().includes("customer") ||
                              column.key.toLowerCase().includes("company") ||
                              column.key.toLowerCase().includes("agent");

                            return (
                              <td key={`${record.id}-${column.key}`} className={isName ? "text-blue" : ""}>
                                {column.type === "boolean"
                                  ? record[column.key]
                                    ? "Yes"
                                    : "No"
                                  : formatCellValue(record[column.key])}
                              </td>
                            );
                          })}
                          <td>
                            <div className="table-actions">
                              {resourceKey === "customers" ? (
                                <button
                                  type="button"
                                  className="icon-button icon-button--view"
                                  onClick={() => handleViewRelatedPolicies(record)}
                                  aria-label="View related policies"
                                  title="View related policies"
                                >
                                  <ViewIcon />
                                </button>
                              ) : null}
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
            </>
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
                        <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
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
                        <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
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
                      <FormLabel required={Boolean(field.required)}>{field.label}</FormLabel>
                      <input
                        type={field.type || "text"}
                        value={formState[field.name]}
                        required={Boolean(field.required)}
                        inputMode={field.validation?.pattern === "^\\d{10}$" ? "numeric" : undefined}
                        pattern={field.validation?.pattern}
                        title={field.validation?.message}
                        maxLength={field.validation?.pattern === "^\\d{10}$" ? 10 : undefined}
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

      {resourceKey === "customers" && relatedPoliciesModal.isOpen ? (
        <div
          className="master-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-related-policies-title"
        >
          <div className="master-modal__backdrop" onClick={resetRelatedPoliciesModal} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="customer-related-policies-title">
                Related Policies - {relatedPoliciesModal.customer?.full_name || "Customer"}
              </h3>
              <button type="button" className="text-button" onClick={resetRelatedPoliciesModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              {relatedPoliciesModal.loading ? (
                <div className="table-state">Loading related policies...</div>
              ) : relatedPoliciesModal.error ? (
                <p className="feedback feedback--error">{relatedPoliciesModal.error}</p>
              ) : (
                <div className="table-wrap">
                  <table className="master-table">
                    <thead>
                      <tr>
                        <th>Policy No.</th>
                        <th>Business Type</th>
                        <th>Policy Type</th>
                        <th>Company</th>
                        <th>Product</th>
                        <th>Issue Date</th>
                        <th>Risk Expiry Date</th>
                        <th>Renewal Status</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedPoliciesModal.policies.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="table-state">
                            No related policies found for this customer.
                          </td>
                        </tr>
                      ) : (
                        relatedPoliciesModal.policies.map((policy) => (
                          <tr key={policy.id}>
                            <td>{formatCellValue(policy.policy_number)}</td>
                            <td>{formatCellValue(policy.business_type)}</td>
                            <td>{formatCellValue(policy.policy_type)}</td>
                            <td className="text-blue">{formatCellValue(policy.company_name)}</td>
                            <td className="text-blue">{formatCellValue(policy.product_name)}</td>
                            <td>{formatCellValue(policy.issue_date)}</td>
                            <td>{formatCellValue(policy.risk_end_date)}</td>
                            <td>{formatCellValue(policy.renewal_status)}</td>
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
