import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("[TypeDuo] Unhandled error:", error, info);
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <h2 className="title" style={{ color: "var(--accent-red)" }}>
            Something went wrong
          </h2>
          <p className="subtle-row">
            TypeDuo hit an unexpected error. You can try resuming, or reload the page to start fresh.
          </p>
          {this.state.error?.message ? (
            <pre>{String(this.state.error.message)}</pre>
          ) : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" className="btn btn-ghost" onClick={this.handleReset}>
              Try again
            </button>
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
