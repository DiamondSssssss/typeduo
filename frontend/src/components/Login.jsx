import { useState } from "react";

const initialForm = {
  username: "",
  email: "",
  password: "",
};

function Login({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const switchMode = (next) => {
    if (mode === next) return;
    setMode(next);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? form
          : { email: form.email, password: form.password };

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_error) {
        data = {};
      }

      if (!response.ok) {
        if (response.status === 502) {
          throw new Error("Server is temporarily unavailable (502). Please try again shortly.");
        }
        throw new Error(data.message || `Authentication failed (${response.status}).`);
      }

      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="auth-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          data-active={mode === "login"}
          onClick={() => switchMode("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          data-active={mode === "register"}
          onClick={() => switchMode("register")}
        >
          Create account
        </button>
      </div>

      <h2 className="title">
        {mode === "login" ? "Welcome back" : "Join the battle"}
      </h2>
      <p className="subtitle">
        {mode === "login"
          ? "Sign in to continue your typing boss battle."
          : "Create an account and challenge a friend to type-and-dodge together."}
      </p>

      <form onSubmit={handleSubmit} className="form">
        {mode === "register" && (
          <input
            className="input"
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            minLength={3}
            required
            autoComplete="username"
          />
        )}
        <input
          className="input"
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
          autoComplete="email"
        />
        <input
          className="input"
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          minLength={6}
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

export default Login;
