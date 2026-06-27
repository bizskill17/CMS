import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

const groups = [
  {
    title: "Masters",
    items: [
      { label: "Organizations", path: "/masters/organizations", countKey: "organizations" },
      { label: "Customers", path: "/masters/customers", countKey: "customers" },
      { label: "States", path: "/masters/states", countKey: "states" },
      { label: "Cities", path: "/masters/cities", countKey: "cities" },
      { label: "Categories", path: "/masters/product-categories", countKey: "product-categories" },
      { label: "Users", path: "/masters/users", countKey: "users" }
    ]
  },
  {
    title: "Leads",
    items: [
      { label: "All Leads", path: "/leads/all", countKey: "leads-all" },
      { label: "Pending Assigning", path: "/leads/pending-assigning", countKey: "leads-pending-assigning" },
      { label: "Pending First Follow Up", path: "/leads/pending-first-follow-up", countKey: "leads-pending-first-follow-up" },
      { label: "Pending Repeat Follow Up", path: "/leads/pending-repeat-follow-up", countKey: "leads-pending-repeat-follow-up" },
      { label: "Converted", path: "/leads/converted", countKey: "leads-converted" },
      { label: "Lost", path: "/leads/lost", countKey: "leads-lost" },
      { label: "Canceled", path: "/leads/canceled", countKey: "leads-canceled" }
    ]
  },
  {
    title: "Tasks",
    items: [
      { label: "All Tasks", path: "/tasks/all", countKey: "tasks-all" },
      { label: "Pending Tasks", path: "/tasks/pending", countKey: "tasks-pending" },
      { label: "Completed", path: "/tasks/completed", countKey: "tasks-completed" },
      { label: "Canceled", path: "/tasks/canceled", countKey: "tasks-canceled" }
    ]
  }
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let isActive = true;

    fetch(`${API_BASE}/menu/counts`)
      .then((res) => res.json())
      .then((json) => {
        if (isActive && json.status === "ok") {
          setCounts(json.data || {});
        }
      })
      .catch((err) => console.error("Failed to fetch dashboard counts", err));

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-grid">
        {groups.map((group) => (
          <section className="master-card dashboard-card" key={group.title}>
            <div className="master-card__header">
              <h3>{group.title}</h3>
            </div>
            <div className="dashboard-list">
              {group.items.map((item) => (
                <button
                  type="button"
                  className="dashboard-tile"
                  key={item.path}
                  onClick={() => navigate(item.path)}
                >
                  <span className="dashboard-tile__content">
                    <span className="dashboard-table__item">{item.label}</span>
                    <span className="dashboard-table__count dashboard-table__count--info">
                      {counts[item.countKey] ?? 0}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
