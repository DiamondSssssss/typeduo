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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "register" ? "/api/auth/register" : "/api/auth/login";
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

      if (typeof data.token === "string" && data.token.trim() !== "") {
        localStorage.setItem("typeduo_token", data.token);
      } else {
        localStorage.removeItem("typeduo_token");
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
      <h2 className="title">{mode === "login" ? "Welcome to TypeDuo" : "Create account"}</h2>
      <p className="subtitle">
        {mode === "login"
          ? "Sign in to continue your typing boss battle."
          : "Join now and play cooperative typing battles."}
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
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}

      <button
        className="btn btn-ghost"
        type="button"
        onClick={() => {
          setMode((prev) => (prev === "login" ? "register" : "login"));
          setError("");
        }}
      >
        {mode === "login"
          ? "Need an account? Register"
          : "Already have an account? Login"}
      </button>
    </div>
  );
}

export default Login;
