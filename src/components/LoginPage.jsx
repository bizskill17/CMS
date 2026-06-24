import { useEffect, useState } from "react";
import { API_BASE } from "../config/api";

async function readApiJson(response) {
  const rawText = await response.text();

  if (!rawText.trim()) {
    throw new Error("API returned an empty response.");
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error("API returned an unreadable response.");
  }
}

export default function LoginPage({ onLogin }) {
  const [formState, setFormState] = useState({
    organization_id: "",
    login_id: "",
    password: ""
  });
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOrganizations() {
      try {
        const response = await fetch(`${API_BASE}/masters/organizations?limit=250`);
        const json = await readApiJson(response);

        if (!response.ok) {
          throw new Error(json.message || "Unable to load organizations.");
        }

        if (!isMounted) {
          return;
        }

        const activeOrganizations = (Array.isArray(json.data) ? json.data : []).filter(
          (organization) => Number(organization.is_active) === 1
        );

        setOrganizations(activeOrganizations);
        setFormState((current) => ({
          ...current,
          organization_id: current.organization_id || String(activeOrganizations[0]?.id || "")
        }));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError.message);
      } finally {
        if (isMounted) {
          setLoadingOrganizations(false);
        }
      }
    }

    loadOrganizations();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formState)
      });

      const json = await readApiJson(response);

      if (!response.ok) {
        throw new Error(json.message || "Login failed.");
      }

      onLogin(json.data);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <div className="login-card__header">
          <h1>Login</h1>
          <p>Select your Organization Id, then enter Log In Id and Password to continue.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span className="form-label">
              Organization Id
              <span className="form-label__required">*</span>
            </span>
            <select
              required
              value={formState.organization_id}
              disabled={loadingOrganizations || organizations.length === 0}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  organization_id: event.target.value
                }))
              }
            >
              <option value="">Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.organization_name} ({organization.organization_code || organization.id})
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-label">
              Log In Id
              <span className="form-label__required">*</span>
            </span>
            <input
              type="text"
              required
              value={formState.login_id}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  login_id: event.target.value
                }))
              }
            />
          </label>

          <label className="form-field">
            <span className="form-label">
              Password
              <span className="form-label__required">*</span>
            </span>
            <input
              type="password"
              required
              value={formState.password}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  password: event.target.value
                }))
              }
            />
          </label>

          {error ? <p className="feedback feedback--error">{error}</p> : null}

          <button
            type="submit"
            className="primary-button login-form__submit"
            disabled={saving || loadingOrganizations || organizations.length === 0}
          >
            {saving ? "Checking..." : "Login"}
          </button>
        </form>
      </section>
    </div>
  );
}
