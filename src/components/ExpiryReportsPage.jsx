import { useNavigate } from "react-router-dom";

const monthlyReports = [
  { label: "April", path: "/reports/expiry-reports/month/4" },
  { label: "May", path: "/reports/expiry-reports/month/5" },
  { label: "June", path: "/reports/expiry-reports/month/6" },
  { label: "July", path: "/reports/expiry-reports/month/7" },
  { label: "August", path: "/reports/expiry-reports/month/8" },
  { label: "September", path: "/reports/expiry-reports/month/9" },
  { label: "October", path: "/reports/expiry-reports/month/10" },
  { label: "November", path: "/reports/expiry-reports/month/11" },
  { label: "December", path: "/reports/expiry-reports/month/12" },
  { label: "January", path: "/reports/expiry-reports/month/1" },
  { label: "February", path: "/reports/expiry-reports/month/2" },
  { label: "March", path: "/reports/expiry-reports/month/3" }
];

const dailyReports = [
  { label: "Today", path: "/reports/expiry-reports/day/today" },
  { label: "Tomorrow", path: "/reports/expiry-reports/day/tomorrow" },
  { label: "Day after Tomorrow", path: "/reports/expiry-reports/day/day-after-tomorrow" }
];

const weeklyReports = [{ label: "Next 7 Days", path: "/reports/expiry-reports/week/7-days" }];
const yearlyReports = [
  { label: "Current Financial Years", path: "/reports/expiry-reports/year/current" },
  { label: "Future Financial Years", path: "/reports/expiry-reports/year/future" }
];

function ExpirySection({ title, items, compact = false, onOpen }) {
  return (
    <section className="expiry-reports__section">
      <h3>{title}</h3>
      <div className={`expiry-reports__grid ${compact ? "expiry-reports__grid--compact" : ""}`}>
        {items.map((item) => (
          <button
            key={item.path}
            type="button"
            className="expiry-reports__button"
            onClick={() => onOpen(item.path)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function ExpiryReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card expiry-reports">
        <ExpirySection title="Monthly Expiry Reports" items={monthlyReports} onOpen={navigate} />
        <ExpirySection title="Daily Expiry Reports" items={dailyReports} onOpen={navigate} />
        <ExpirySection title="Weekly Expiry Reports" items={weeklyReports} compact onOpen={navigate} />
        <ExpirySection title="Yearly Expiry Reports" items={yearlyReports} onOpen={navigate} />
      </section>
    </div>
  );
}
