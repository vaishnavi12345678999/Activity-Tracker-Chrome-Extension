// src/pages/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import { format, parseISO, startOfDay, addDays } from "date-fns";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "../styles/Dashboard.css"; // keep your styles or swap to Tailwind

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export default function Dashboard() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // date-range (default last 7 days)
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fromDate, setFromDate] = useState(format(startOfDay(addDays(new Date(), -6)), "yyyy-MM-dd"));

  // view: domain or page
  const [view, setView] = useState("domain");

  // fetch activities (backend route: GET /api/activity/me). See routes. :contentReference[oaicite:2]{index=2}
  useEffect(() => {
    if (!token) {
      setError("No token found. Please login via extension or localStorage.");
      return;
    }

    const source = axios.CancelToken.source();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE}/api/activity/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cancelToken: source.token,
        });
        // activities shape stored by backend: { name, duration, date, user } per model. :contentReference[oaicite:3]{index=3}
        setActivities(res.data.activities || []);
      } catch (err) {
        if (!axios.isCancel(err)) setError(err.message || "Failed to load activities");
      } finally {
        setLoading(false);
      }
    })();

    return () => source.cancel();
  }, [token]);

  // filter activities by date range
  const filtered = useMemo(() => {
    const start = startOfDay(parseISO(fromDate)).getTime();
    const end = startOfDay(parseISO(toDate)).getTime() + 24 * 60 * 60 * 1000;
    return activities.filter((a) => {
      const t = a.date ? new Date(a.date).getTime() : 0;
      return t >= start && t < end;
    });
  }, [activities, fromDate, toDate]);

  // aggregate totals
  const { perSite, perPage, totalSeconds } = useMemo(() => {
    const ps = {};
    const pp = {};
    let total = 0;
    filtered.forEach((a) => {
      const site = a.name || a.domain || "unknown"; // backend stores 'name' (domain). :contentReference[oaicite:4]{index=4}
      const dur = Number(a.duration ?? 0);
      total += dur;
      ps[site] = (ps[site] || 0) + dur;

      // if you have original URL stored in a different field, adapt here (we assume name is domain and url may be absent)
      const pageKey = a.url || `${site}`; // fallback to domain
      pp[pageKey] = (pp[pageKey] || 0) + dur;
    });
    return { perSite: ps, perPage: pp, totalSeconds: total };
  }, [filtered]);

  // chart data (top 10 sites)
  const topSites = useMemo(() => Object.entries(perSite).sort((a, b) => b[1] - a[1]).slice(0, 10), [perSite]);

  const barData = {
    labels: topSites.map((s) => s[0]),
    datasets: [
      {
        label: "Time (minutes)",
        data: topSites.map(([, sec]) => Math.round(sec / 60)),
        backgroundColor: "#7c3aed",
      },
    ],
  };

  // CSV export
  function exportCsv() {
    const rows = [["date", "site", "page", "duration_seconds"]];
    filtered.forEach((a) => {
      rows.push([a.date || "", a.name || "", a.url || "", a.duration || 0]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const human = (s) => {
    if (!s) return "0s";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h ? h + "h " : ""}${m ? m + "m " : ""}${sec}s`;
  };

  return (
    <div className="dashboard-root">
      <header className="dash-header">
        <div>
          <h1>Activity Dashboard</h1>
          <p className="muted">Overview of your site usage</p>
        </div>
        <div className="summary">
          <div className="small muted">Total</div>
          <div className="big">{human(totalSeconds)}</div>
        </div>
      </header>

      <section className="controls">
        <div className="range">
          <label>From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <label>To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <button className="btn" onClick={() => {
            setFromDate(format(startOfDay(addDays(new Date(), -6)), "yyyy-MM-dd"));
            setToDate(format(new Date(), "yyyy-MM-dd"));
          }}>Last 7d</button>
        </div>

        <div className="view-toggle">
          <button className={view === "domain" ? "active" : ""} onClick={() => setView("domain")}>Domain Activity</button>
          <button className={view === "page" ? "active" : ""} onClick={() => setView("page")}>Page Activity</button>
          <button className="btn-outline" onClick={exportCsv}>Export CSV</button>
        </div>
      </section>

      <main className="grid">
        <div className="card chart-card">
          <h3>Top sites (minutes)</h3>
          <Bar data={barData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
        </div>

        <div className="card list-card">
          <h3>{view === "domain" ? "Per-domain totals" : "Per-page totals"}</h3>
          <div className="list-scroll">
            <table className="simple-table">
              <thead>
                <tr><th>#</th><th>{view === "domain" ? "Domain" : "Page"}</th><th>Time</th></tr>
              </thead>
              <tbody>
                {(view === "domain" ? Object.entries(perSite) : Object.entries(perPage))
                  .sort((a,b)=> b[1]-a[1])
                  .slice(0, 200)
                  .map(([key, sec], i) => (
                    <tr key={key}>
                      <td>{i+1}</td>
                      <td className="mono">{key}</td>
                      <td>{human(sec)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {loading && <div className="muted">Loading…</div>}
      {error && <div className="error">Error: {error}</div>}
    </div>
  );
}
