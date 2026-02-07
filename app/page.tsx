"use client";

import { useEffect, useState } from "react";

interface HealthStatus {
  status: string;
  message: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          setError("API server returned an error");
        }
      } catch {
        setError("API server is starting up...");
      } finally {
        setLoading(false);
      }
    };

    // Give the Express server a moment to start
    const timer = setTimeout(checkHealth, 2000);
    return () => clearTimeout(timer);
  }, []);

  const endpoints = [
    { method: "POST", path: "/api/auth/register", description: "Register a new user" },
    { method: "POST", path: "/api/auth/login", description: "Login user" },
    { method: "GET", path: "/api/auth/profile", description: "Get user profile" },
    { method: "POST", path: "/api/rides/request", description: "Request a ride" },
    { method: "GET", path: "/api/rides/my-rides", description: "Get user rides" },
    { method: "POST", path: "/api/deliveries/request", description: "Request a delivery" },
    { method: "GET", path: "/api/deliveries/my-deliveries", description: "Get user deliveries" },
    { method: "GET", path: "/api/users/nearby-drivers", description: "Find nearby drivers" },
    { method: "GET", path: "/api/promo", description: "Get promo codes" },
    { method: "GET", path: "/api/loyalty/points", description: "Get loyalty points" },
    { method: "GET", path: "/api/health", description: "API health check" },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0a", color: "#ededed", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: "48px" }}>
          <h1 style={{ fontSize: "36px", fontWeight: 700, marginBottom: "8px", color: "#fff" }}>
            Mzansi API
          </h1>
          <p style={{ fontSize: "16px", color: "#888" }}>
            Ride-sharing and delivery backend service
          </p>
        </div>

        <div
          style={{
            padding: "20px 24px",
            borderRadius: "12px",
            border: "1px solid #222",
            backgroundColor: "#111",
            marginBottom: "32px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: loading ? "#f59e0b" : health ? "#22c55e" : "#ef4444",
              boxShadow: loading
                ? "0 0 8px #f59e0b"
                : health
                ? "0 0 8px #22c55e"
                : "0 0 8px #ef4444",
            }}
          />
          <span style={{ fontSize: "14px", color: "#ccc" }}>
            {loading
              ? "Checking API status..."
              : health
              ? `API is running - ${health.message}`
              : error || "API is offline"}
          </span>
        </div>

        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "16px", color: "#fff" }}>
            API Endpoints
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {endpoints.map((ep) => (
              <div
                key={`${ep.method}-${ep.path}`}
                style={{
                  padding: "14px 18px",
                  borderRadius: "8px",
                  border: "1px solid #222",
                  backgroundColor: "#111",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: ep.method === "GET" ? "#1a3a2a" : "#3a2a1a",
                    color: ep.method === "GET" ? "#4ade80" : "#fb923c",
                    minWidth: "48px",
                    textAlign: "center" as const,
                  }}
                >
                  {ep.method}
                </span>
                <code style={{ fontSize: "13px", color: "#ddd", fontFamily: "monospace", flex: 1 }}>
                  {ep.path}
                </code>
                <span style={{ fontSize: "13px", color: "#666" }}>{ep.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #222" }}>
          <p style={{ fontSize: "13px", color: "#555" }}>
            Socket.IO real-time events available at ws://localhost:5000
          </p>
        </div>
      </div>
    </div>
  );
}
