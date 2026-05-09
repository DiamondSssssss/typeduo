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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
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
    <div style={styles.card}>
      <h2>{mode === "login" ? "Login" : "Register"}</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        {mode === "register" && (
          <input
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            minLength={3}
            required
          />
        )}
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          minLength={6}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>

      {error ? <p style={styles.error}>{error}</p> : null}

      <button
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

const styles = {
  card: {
    maxWidth: 360,
    margin: "0 auto",
    padding: 16,
    border: "1px solid #ddd",
    borderRadius: 8,
    display: "grid",
    gap: 12,
  },
  form: {
    display: "grid",
    gap: 10,
  },
  error: {
    color: "crimson",
    margin: 0,
  },
};

export default Login;
