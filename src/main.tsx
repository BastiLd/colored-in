import { createRoot } from "react-dom/client";
import { Component, ErrorInfo, ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

// Error Boundary to catch React errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Must be pure (no side-effects). We log in componentDidCatch instead.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "40px",
          fontFamily: "sans-serif",
          backgroundColor: "#1a1a1a",
          color: "white",
          minHeight: "100vh"
        }}>
          <h1 style={{ color: "#f87171" }}>Something went wrong</h1>
          <p>Error: {this.state.error?.message}</p>
          <pre style={{
            backgroundColor: "#2a2a2a",
            padding: "16px",
            borderRadius: "8px",
            overflow: "auto",
            fontSize: "12px"
          }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:white;background:#1a1a1a;min-height:100vh;"><h1>Error: Root element not found</h1></div>';
} else {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
