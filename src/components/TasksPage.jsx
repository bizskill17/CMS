import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionIconButton } from "./ActionIcon";
import FormLabel from "./FormLabel";
import ResponsiveDataView from "./ResponsiveDataView";
import { API_BASE } from "../config/api";
import { ButtonSpinner, Spinner } from "./Spinner";
import { buildFilterOptions } from "../utils/dataView";
import { formatCellValue } from "../utils/formatting";

const taskViewConfigs = {
  "/tasks/all": {
    title: "All Tasks",
    endpoint: `${API_BASE}/tasks?view=all`,
    emptyMessage: "No tasks found."
  },
  "/tasks/add": {
    title: "Add Task",
    endpoint: `${API_BASE}/tasks?view=all`,
    emptyMessage: "No tasks found.",
    autoOpenAdd: true
  },
  "/tasks/pending": {
    title: "Pending Tasks",
    endpoint: `${API_BASE}/tasks?view=pending`,
    emptyMessage: "No pending tasks found."
  },
  "/tasks/completed": {
    title: "Completed",
    endpoint: `${API_BASE}/tasks?view=completed`,
    emptyMessage: "No completed tasks found."
  },
  "/tasks/canceled": {
    title: "Canceled",
    endpoint: `${API_BASE}/tasks?view=canceled`,
    emptyMessage: "No canceled tasks found."
  },
  "/tasks/action-log": {
    title: "Action Log",
    endpoint: `${API_BASE}/tasks/activity`,
    emptyMessage: "No task activity found.",
    activityLog: true
  }
};

const taskColumns = [
  { key: "task_date", label: "Task Date" },
  { key: "description", label: "Description", width: "220px" },
  { key: "due_date", label: "Due Date" },
  { key: "client_name", label: "Client Name", width: "170px" },
  { key: "priority", label: "Priority" },
  { key: "assigned_to_name", label: "Assigned To", width: "160px" },
  { key: "category_name", label: "Category", width: "160px" },
  { key: "sub_category_name", label: "Sub - Category", width: "170px" },
  { key: "task_status", label: "Status", width: "170px" },
  { key: "next_follow_up_date", label: "Next Follow Up Date", width: "140px" }
];

const activityColumns = [
  { key: "activity_type", label: "Activity Type", width: "130px" },
  { key: "client_name", label: "Client Name", width: "170px" },
  { key: "task_status", label: "Task Status", width: "170px" },
  { key: "update_status", label: "Update Status", width: "120px" },
  { key: "activity_date", label: "Date", width: "120px" },
  { key: "assigned_to_name", label: "Assigned To", width: "160px" },
  { key: "next_follow_up_date", label: "Next Follow Up Date", width: "140px" },
  { key: "remarks", label: "Remarks", width: "240px" }
];

const priorityOptions = ["High", "Medium", "Low"];
const updateStatusOptions = ["Success", "Follow Up Again", "Cancel"];
const finalTaskStatuses = ["Completed", "Canceled"];

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyTaskForm() {
  return {
    task_date: todayInputValue(),
    description: "",
    due_date: todayInputValue(),
    client_name: "",
    priority: "Medium",
    assigned_to_user_id: "",
    category_id: "",
    sub_category_id: "",
    notes: ""
  };
}

function emptyUpdateForm() {
  return {
    status: "Success",
    update_date: todayInputValue(),
    next_follow_up_date: "",
    remarks: ""
  };
}

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

function normalizeTaskToForm(task) {
  return {
    task_date: String(task.task_date || "").slice(0, 10),
    description: task.description || "",
    due_date: String(task.due_date || "").slice(0, 10),
    client_name: task.client_name || "",
    priority: task.priority || "Medium",
    assigned_to_user_id: task.assigned_to_user_id ? String(task.assigned_to_user_id) : "",
    category_id: task.category_id ? String(task.category_id) : "",
    sub_category_id: task.sub_category_id ? String(task.sub_category_id) : "",
    notes: task.notes || ""
  };
}

export default function TasksPage({ viewPath }) {
  const navigate = useNavigate();
  const viewConfig = taskViewConfigs[viewPath] || taskViewConfigs["/tasks/all"];
  const isActivityLog = Boolean(viewConfig.activityLog);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taskForm, setTaskForm] = useState(() => emptyTaskForm());
  const [customerQuery, setCustomerQuery] = useState("");
  const [updateForm, setUpdateForm] = useState(() => emptyUpdateForm());
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedHistoryTask, setSelectedHistoryTask] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAssigneeOnly, setIsAssigneeOnly] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRecords = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(viewConfig.endpoint);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load tasks.");
      }

      setRecords(json.data || []);
      setRefreshKey((k) => k + 1);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [viewConfig.endpoint]);

  useEffect(() => {
    if (isActivityLog) {
      return;
    }

    let isActive = true;

    const loadOptions = async () => {
      try {
        const [usersResponse, customersResponse, categoriesResponse] = await Promise.all([
          fetch(`${API_BASE}/masters/users?limit=250`),
          fetch(`${API_BASE}/masters/customers?limit=250`),
          fetch(`${API_BASE}/masters/product-categories?limit=250`)
        ]);

        const [usersJson, customersJson, categoriesJson] = await Promise.all([
          readApiJson(usersResponse),
          readApiJson(customersResponse),
          readApiJson(categoriesResponse)
        ]);

        if (!usersResponse.ok) {
          throw new Error(usersJson.message || "Failed to load users.");
        }

        if (!categoriesResponse.ok) {
          throw new Error(categoriesJson.message || "Failed to load categories.");
        }

        if (!customersResponse.ok) {
          throw new Error(customersJson.message || "Failed to load customers.");
        }

        if (!isActive) {
          return;
        }

        setUsers(usersJson.data || []);
        setCustomers(customersJson.data || []);
        setCategories(categoriesJson.data || []);
      } catch (loadOptionsError) {
        if (isActive) {
          setError(loadOptionsError.message);
        }
      }
    };

    loadOptions();

    return () => {
      isActive = false;
    };
  }, [isActivityLog]);

  useEffect(() => {
    if (viewConfig.autoOpenAdd) {
      setEditingTaskId(null);
      setTaskForm(emptyTaskForm());
      setIsTaskModalOpen(true);
    } else {
      setIsTaskModalOpen(false);
    }
  }, [viewConfig.autoOpenAdd, viewPath]);

  const topLevelCategories = useMemo(
    () => categories.filter((category) => !category.parent_category_id),
    [categories]
  );

  const subCategories = useMemo(
    () =>
      categories.filter(
        (category) => String(category.parent_category_id || "") === String(taskForm.category_id || "")
      ),
    [categories, taskForm.category_id]
  );

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      if (!query) {
        return true;
      }

      return (
        String(customer.full_name || "").toLowerCase().includes(query) ||
        String(customer.customer_code || "").toLowerCase().includes(query) ||
        String(customer.mobile || "").toLowerCase().includes(query)
      );
    });
  }, [customerQuery, customers]);

  const filterConfigs = useMemo(() => {
    if (isActivityLog) {
      return [
        { key: "activity_type", label: "Activity Type", options: buildFilterOptions(records, "activity_type") },
        { key: "task_status", label: "Task Status", options: buildFilterOptions(records, "task_status") },
        { key: "assigned_to_name", label: "Assigned To", options: buildFilterOptions(records, "assigned_to_name") }
      ];
    }

    return [
      { key: "priority", label: "Priority", options: buildFilterOptions(records, "priority") },
      { key: "task_status", label: "Status", options: buildFilterOptions(records, "task_status") },
      { key: "assigned_to_name", label: "Assigned To", options: buildFilterOptions(records, "assigned_to_name") },
      { key: "category_name", label: "Category", options: buildFilterOptions(records, "category_name") }
    ];
  }, [isActivityLog, records]);

  const resetTaskModal = () => {
    setIsTaskModalOpen(false);
    setIsAssigneeOnly(false);
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm());
    setCustomerQuery("");

    if (viewPath === "/tasks/add") {
      navigate("/tasks/all");
    }
  };

  const resetUpdateModal = () => {
    setIsUpdateModalOpen(false);
    setSelectedTask(null);
    setTaskHistory([]);
    setHistoryLoading(false);
    setUpdateForm(emptyUpdateForm());
  };

  const openAddTask = () => {
    setMessage("");
    setError("");
    setEditingTaskId(null);
    setTaskForm(emptyTaskForm());
    setCustomerQuery("");
    setIsAssigneeOnly(false);
    setIsTaskModalOpen(true);
  };

  const openEditTask = (task) => {
    setMessage("");
    setError("");
    setEditingTaskId(task.id);
    setTaskForm(normalizeTaskToForm(task));
    setCustomerQuery(task.client_name || "");
    setIsAssigneeOnly(false);
    setIsTaskModalOpen(true);
  };

  const openAssignTask = (task) => {
    setMessage("");
    setError("");
    setEditingTaskId(task.id);
    setTaskForm(normalizeTaskToForm(task));
    setCustomerQuery(task.client_name || "");
    setIsAssigneeOnly(true);
    setIsTaskModalOpen(true);
  };

  const openUpdateTask = async (task) => {
    setMessage("");
    setError("");
    setSelectedTask(task);
    setUpdateForm({
      ...emptyUpdateForm(),
      next_follow_up_date: String(task.next_follow_up_date || "").slice(0, 10)
    });
    setIsUpdateModalOpen(true);
    await loadTaskHistory(task, { syncModalSelection: false });
  };

  const loadTaskHistory = async (task, options = {}) => {
    const { syncModalSelection = true } = options;

    setHistoryLoading(true);
    if (syncModalSelection) {
      setSelectedHistoryTask(task);
    }

    try {
      const response = await fetch(`${API_BASE}/tasks/${task.id}/updates`);
      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to load task activity.");
      }

      setTaskHistory(json.data || []);
    } catch (historyError) {
      setError(historyError.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTaskFormChange = (field, value) => {
    setTaskForm((current) => ({
      ...current,
      ...(field === "category_id" ? { sub_category_id: "" } : {}),
      [field]: value
    }));
  };

  const handleUpdateFormChange = (field, value) => {
    setUpdateForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleTaskSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!taskForm.client_name) {
      setError("Please select a valid customer from Master Customers.");
      return;
    }

    setSavingTask(true);

    try {
      const response = await fetch(
        editingTaskId ? `${API_BASE}/tasks/${editingTaskId}` : `${API_BASE}/tasks`,
        {
          method: editingTaskId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(taskForm)
        }
      );

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to save task.");
      }

      setMessage(json.message || "Task saved successfully.");
      resetTaskModal();
      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingTask(false);
    }
  };

  const handleUpdateSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTask) {
      return;
    }

    setMessage("");
    setError("");
    setSavingUpdate(true);

    try {
      const response = await fetch(`${API_BASE}/tasks/${selectedTask.id}/updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updateForm)
      });

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to save task update.");
      }

      setMessage(json.message || "Task update saved successfully.");
      resetUpdateModal();
      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingUpdate(false);
    }
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Are you sure you want to delete task for "${task.client_name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/tasks/${task.id}`, {
        method: "DELETE"
      });

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Failed to delete task.");
      }

      window.dispatchEvent(new Event("refresh-counts"));
      await loadRecords();
    } catch (deleteError) {
      alert(deleteError.message);
    }
  };

  const renderTaskActions = (task) => {
    const isUnassigned = !task.assigned_to_user_id;
    const canFollowUp = !finalTaskStatuses.includes(String(task.task_status || ""));

    return (
      <div className="table-actions">
        {isUnassigned ? (
          <ActionIconButton icon="user" label="Update Assignee" onClick={() => openAssignTask(task)} />
        ) : null}
        <ActionIconButton icon="pencil" label="Edit Task" onClick={() => openEditTask(task)} />
        {canFollowUp ? (
          <ActionIconButton icon="tick" label="Update Task" tone="primary" onClick={() => openUpdateTask(task)} />
        ) : null}
        <ActionIconButton icon="delete" label="Delete Task" tone="danger" onClick={() => deleteTask(task)} />
      </div>
    );
  };

  const currentColumns = isActivityLog ? activityColumns : taskColumns;
  const currentSearchKeys = isActivityLog
    ? ["activity_type", "client_name", "task_status", "update_status", "assigned_to_name", "remarks"]
    : [
        "description",
        "client_name",
        "priority",
        "assigned_to_name",
        "category_name",
        "sub_category_name",
        "task_status",
        "notes"
      ];

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card">
        {message ? <p className="feedback feedback--success">{message}</p> : null}
        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <ResponsiveDataView
          key={`${viewPath}-${refreshKey}`}
          title={viewConfig.title}
          records={records}
          columns={currentColumns}
          loading={loading}
          error=""
          loadingMessage={isActivityLog ? "Loading task activity..." : "Loading tasks..."}
          emptyMessage={viewConfig.emptyMessage}
          searchKeys={currentSearchKeys}
          filterConfigs={filterConfigs}
          renderActions={isActivityLog ? null : renderTaskActions}
          rowKey={isActivityLog ? "activity_key" : "id"}
          onRowClick={
            !isActivityLog
              ? (task) => {
                  setSelectedHistoryTask(task);
                  loadTaskHistory(task);
                }
              : null
          }
          selectedRowKey={!isActivityLog ? selectedHistoryTask?.id ?? null : null}
          headerExtras={
            !isActivityLog ? (
              <button type="button" className="primary-button" onClick={openAddTask}>
                Add Task
              </button>
            ) : null
          }
          customFilterContent={null}
          onClearCustomFilters={() => {}}
        />
      </section>

      {!isActivityLog && selectedHistoryTask ? (
        <section className="master-card issue-policy-card">
          <div className="master-card__header">
            <h3>Activity History</h3>
          </div>

          <div className="lead-summary-grid">
            <div className="record-card__field">
              <span>Client Name</span>
              <strong>{formatCellValue(selectedHistoryTask.client_name)}</strong>
            </div>
            <div className="record-card__field">
              <span>Assigned To</span>
              <strong>{formatCellValue(selectedHistoryTask.assigned_to_name)}</strong>
            </div>
          </div>

          {historyLoading ? (
            <div className="table-state">
              <Spinner label="Loading task activity..." />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="master-table">
                <thead>
                  <tr>
                    <th>Sl.No.</th>
                    <th>Status</th>
                    <th>Update Date</th>
                    <th>Next Follow Up Date</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {taskHistory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="table-state">
                        No activity found for this task.
                      </td>
                    </tr>
                  ) : (
                    taskHistory.map((item, index) => (
                      <tr key={item.id || `${item.update_date}-${index + 1}`}>
                        <td>{index + 1}</td>
                        <td>{formatCellValue(item.status)}</td>
                        <td>{formatCellValue(item.update_date)}</td>
                        <td>{formatCellValue(item.next_follow_up_date)}</td>
                        <td>{formatCellValue(item.remarks)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {isTaskModalOpen ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
          <div className="master-modal__backdrop" onClick={resetTaskModal} />
          <section className={`master-card master-modal__panel ${isAssigneeOnly ? "master-modal__panel--small" : ""}`}>
            <div className="master-card__header">
              <h3 id="task-form-title">
                {isAssigneeOnly ? "Update Assignee" : editingTaskId ? "Edit Task" : "Add Task"}
              </h3>
              <button type="button" className="text-button" onClick={resetTaskModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <form className={`master-form ${isAssigneeOnly ? "master-form--single" : ""}`} onSubmit={handleTaskSubmit}>
                {!isAssigneeOnly && (
                  <>
                    <label className="form-field">
                      <FormLabel required>Description</FormLabel>
                      <input
                        type="text"
                        required
                        value={taskForm.description}
                        onChange={(event) => handleTaskFormChange("description", event.target.value)}
                      />
                    </label>

                    <label className="form-field">
                      <FormLabel required>Due Date</FormLabel>
                      <input
                        type="date"
                        required
                        value={taskForm.due_date}
                        onChange={(event) => handleTaskFormChange("due_date", event.target.value)}
                      />
                    </label>

                    <label className="form-field">
                      <FormLabel required>Client Name</FormLabel>
                      <input
                        list="task-customer-options"
                        required
                        value={customerQuery}
                        placeholder="Search customer by name, code, or mobile"
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setCustomerQuery(nextValue);
                          const match = filteredCustomers.find((customer) => customer.full_name === nextValue);
                          handleTaskFormChange("client_name", match ? match.full_name : "");
                        }}
                      />
                      <datalist id="task-customer-options">
                        {filteredCustomers.map((customer) => (
                          <option
                            key={customer.id}
                            value={customer.full_name}
                          >{`${customer.customer_code || ""} ${customer.mobile || ""}`.trim()}</option>
                        ))}
                      </datalist>
                    </label>

                    <label className="form-field">
                      <FormLabel required>Priority</FormLabel>
                      <select
                        required
                        value={taskForm.priority}
                        onChange={(event) => handleTaskFormChange("priority", event.target.value)}
                      >
                        {priorityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <FormLabel required>Task Date</FormLabel>
                      <input
                        type="date"
                        required
                        value={taskForm.task_date}
                        onChange={(event) => handleTaskFormChange("task_date", event.target.value)}
                      />
                    </label>
                  </>
                )}

                <label className="form-field">
                  <FormLabel>Assigned To</FormLabel>
                  <select
                    value={taskForm.assigned_to_user_id}
                    onChange={(event) => handleTaskFormChange("assigned_to_user_id", event.target.value)}
                  >
                    <option value="">Select User</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                {!isAssigneeOnly && (
                  <>
                    <label className="form-field">
                      <FormLabel required>Category</FormLabel>
                      <select
                        required
                        value={taskForm.category_id}
                        onChange={(event) => handleTaskFormChange("category_id", event.target.value)}
                      >
                        <option value="">Select Category</option>
                        {topLevelCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.category_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <FormLabel required>Sub - Category</FormLabel>
                      <select
                        required
                        value={taskForm.sub_category_id}
                        onChange={(event) => handleTaskFormChange("sub_category_id", event.target.value)}
                        disabled={!taskForm.category_id}
                      >
                        <option value="">Select Sub - Category</option>
                        {subCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.category_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <FormLabel>Notes</FormLabel>
                      <textarea
                        rows="4"
                        value={taskForm.notes}
                        onChange={(event) => handleTaskFormChange("notes", event.target.value)}
                      />
                    </label>
                  </>
                )}

                <div className="form-actions">
                  <button type="button" className="secondary-button form-actions__cancel" onClick={resetTaskModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={savingTask}>
                    {savingTask
                      ? <ButtonSpinner label="Saving..." />
                      : isAssigneeOnly
                      ? "Update Assignee"
                      : editingTaskId
                      ? "Update Task"
                      : "Save Task"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {isUpdateModalOpen && selectedTask ? (
        <div className="master-modal" role="dialog" aria-modal="true" aria-labelledby="task-update-title">
          <div className="master-modal__backdrop" onClick={resetUpdateModal} />
          <section className="master-card master-modal__panel master-modal__panel--wide">
            <div className="master-card__header">
              <h3 id="task-update-title">Task Update</h3>
              <button type="button" className="text-button" onClick={resetUpdateModal}>
                Cancel
              </button>
            </div>

            <div className="master-modal__body">
              <div className="lead-summary-grid">
                <div className="record-card__field">
                  <span>Client Name</span>
                  <strong>{formatCellValue(selectedTask.client_name)}</strong>
                </div>
                <div className="record-card__field">
                  <span>Assigned To</span>
                  <strong>{formatCellValue(selectedTask.assigned_to_name)}</strong>
                </div>
              </div>

              <form className="master-form" onSubmit={handleUpdateSubmit}>
                <label className="form-field">
                  <FormLabel>Status</FormLabel>
                  <select
                    value={updateForm.status}
                    onChange={(event) => handleUpdateFormChange("status", event.target.value)}
                  >
                    {updateStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <FormLabel required>Update Date</FormLabel>
                  <input
                    type="date"
                    required
                    value={updateForm.update_date}
                    onChange={(event) => handleUpdateFormChange("update_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required={updateForm.status === "Follow Up Again"}>Next Follow Up Date</FormLabel>
                  <input
                    type="date"
                    required={updateForm.status === "Follow Up Again"}
                    value={updateForm.next_follow_up_date}
                    onChange={(event) => handleUpdateFormChange("next_follow_up_date", event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <FormLabel required={updateForm.status !== "Success"}>Remarks</FormLabel>
                  <textarea
                    rows="4"
                    required={updateForm.status !== "Success"}
                    value={updateForm.remarks}
                    onChange={(event) => handleUpdateFormChange("remarks", event.target.value)}
                  />
                </label>

                <div className="form-actions">
                  <button type="button" className="secondary-button form-actions__cancel" onClick={resetUpdateModal}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={savingUpdate}>
                    {savingUpdate ? <ButtonSpinner label="Saving..." /> : "Save Update"}
                  </button>
                </div>
              </form>

              <div className="lead-history">
                <div className="master-card__header">
                  <h3>Activity History</h3>
                </div>

                {historyLoading ? (
                  <div className="table-state">
                    <Spinner label="Loading task activity..." />
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="master-table">
                      <thead>
                        <tr>
                          <th>Sl.No.</th>
                          <th>Status</th>
                          <th>Update Date</th>
                          <th>Next Follow Up Date</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskHistory.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="table-state">
                              No activity found for this task.
                            </td>
                          </tr>
                        ) : (
                          taskHistory.map((item, index) => (
                            <tr key={item.id || `${item.update_date}-${index + 1}`}>
                              <td>{index + 1}</td>
                              <td>{formatCellValue(item.status)}</td>
                              <td>{formatCellValue(item.update_date)}</td>
                              <td>{formatCellValue(item.next_follow_up_date)}</td>
                              <td>{formatCellValue(item.remarks)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
