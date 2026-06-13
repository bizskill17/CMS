const monthlyReports = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March"
];

const dailyReports = ["Today", "Tomorrow", "Day after Tomorrow"];
const weeklyReports = ["Next 7 Days"];
const yearlyReports = ["Current Financial Years", "Future Financial Years"];

function ExpirySection({ title, items, compact = false }) {
  return (
    <section className="expiry-reports__section">
      <h3>{title}</h3>
      <div className={`expiry-reports__grid ${compact ? "expiry-reports__grid--compact" : ""}`}>
        {items.map((item) => (
          <button key={item} type="button" className="expiry-reports__button">
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function ExpiryReportsPage() {
  return (
    <div className="page-shell issue-policy-page">
      <section className="master-card issue-policy-card expiry-reports">
        <ExpirySection title="Monthly Expiry Reports" items={monthlyReports} />
        <ExpirySection title="Daily Expiry Reports" items={dailyReports} />
        <ExpirySection title="Weekly Expiry Reports" items={weeklyReports} compact />
        <ExpirySection title="Yearly Expiry Reports" items={yearlyReports} />
      </section>
    </div>
  );
}
