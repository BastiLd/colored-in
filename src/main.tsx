import { createRoot } from "react-dom/client";
import { Component, ErrorInfo, ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

// #region agent log
// Minimal runtime logger (NDJSON via local ingest server). Never log secrets.
function __agentLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown> = {}) {
  try {
    fetch("http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location,
        message,
        data,
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId,
      }),
    }).catch(() => { });
  } catch {
    // ignore
  }
}
// #endregion

// Error Boundary to catch React errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // #region agent log
    __agentLog("A", "src/main.tsx:getDerivedStateFromError", "React render error captured", {
      name: error?.name,
      message: error?.message,
      stackHead: typeof error?.stack === "string" ? error.stack.slice(0, 500) : null,
      href: typeof window !== "undefined" ? window.location.href : null,
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
    });
    // #endregion
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught:", error, errorInfo);
    // #region agent log
    __agentLog("A", "src/main.tsx:componentDidCatch", "React error boundary didCatch", {
      name: error?.name,
      message: error?.message,
      stackHead: typeof error?.stack === "string" ? error.stack.slice(0, 800) : null,
      componentStackHead:
        typeof errorInfo?.componentStack === "string"
          ? errorInfo.componentStack.slice(0, 800)
          : null,
      href: typeof window !== "undefined" ? window.location.href : null,
      pathname: typeof window !== "undefined" ? window.location.pathname : null,
    });
    // #endregion
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
  // #region agent log
  __agentLog("B", "src/main.tsx:bootstrap", "Root element not found", {
    href: typeof window !== "undefined" ? window.location.href : null,
    pathname: typeof window !== "undefined" ? window.location.pathname : null,
  });
  // #endregion
  document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:white;background:#1a1a1a;min-height:100vh;"><h1>Error: Root element not found</h1></div>';
} else {
  // #region agent log
  __agentLog("C", "src/main.tsx:bootstrap", "React root mounting", {
    href: window.location.href,
    pathname: window.location.pathname,
    baseUrl: (import.meta as any)?.env?.BASE_URL,
  });
  // #endregion
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
