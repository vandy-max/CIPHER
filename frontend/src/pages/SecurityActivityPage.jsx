/**
 * SecurityActivityPage.jsx
 * -------------------------
 * One consolidated activity/audit view, replacing the previous iteration's
 * separate "Audit & Risk Center" (with its standalone risk-calculator
 * playground) and "Transaction History" pages. All data below comes from
 * the existing GET /api/logs and GET /api/dashboard-stats endpoints —
 * no new backend endpoints were added for this page.
 */
import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { getLogs, getDashboardStats } from "../services/api";

const RISK_COLORS = { LOW:"#157a45", MEDIUM:"#b45309", HIGH:"#b3261e" };
const TT = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, color:"#111827", fontSize:12, boxShadow:"0 2px 8px rgba(0,0,0,.08)" };

export default function SecurityActivityPage() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs]   = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error);
    getLogs(100).then(d => setLogs(d.logs)).catch(console.error);
  }, []);

  const pieData = stats
    ? Object.entries(stats.risk_distribution || {}).map(([name, value]) => ({ name, value }))
    : [];

  const eventMap = logs.reduce((acc, l) => { acc[l.event_type] = (acc[l.event_type] || 0) + 1; return acc; }, {});
  const barData = Object.entries(eventMap)
    .map(([type, count]) => ({ type: type.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count).slice(0, 8);

  const filteredLogs = logs.filter(l => filter === "all" ? true : l.risk_level === filter.toUpperCase());

  return (
    <div className="page">
      <div className="ph">
        <h1>Security <span className="grad">Activity</span></h1>
        <p style={{color:"var(--text2)",marginTop:6,fontSize:15}}>Every intent, context, quantum, insider-risk and face-identity decision CipherQ has made on your account</p>
      </div>

      {stats && (
        <div className="stats-row">
          {[
            { label:"Total Events",  value: stats.total_security_events, icon:"▲" },
            { label:"Records Sent",  value: stats.protected_records_sent, icon:"⬡" },
            { label:"Records Received", value: stats.protected_records_received, icon:"◫" },
            { label:"Avg QBER",      value: `${(stats.average_qber*100).toFixed(2)}%`, icon:"◈" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="charts-grid">
        <div className="card c-violet">
          <h2>Risk Distribution</h2>
          {pieData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {pieData.map(d => <Cell key={d.name} fill={RISK_COLORS[d.name] || "#8b95a7"} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="empty-t">No events yet — send a Protected Record to populate this chart.</p>}
        </div>
        <div className="card c-sky">
          <h2>Event Types</h2>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical" margin={{left:10}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{fontSize:11}} />
                <YAxis type="category" dataKey="type" tick={{fontSize:10.5}} width={110} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" fill="#0d7a80" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="empty-t">No events yet.</p>}
        </div>
      </div>

      <div className="card c-indigo">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <h2 style={{marginBottom:0}}>Activity Log</h2>
          <div style={{display:"flex",gap:8}}>
            {[["all","All"],["low","Low"],["medium","Medium"],["high","High"]].map(([k,l]) => (
              <button key={k} className={`btn ${filter===k?"btn-primary":"btn-ghost"}`} style={{padding:"7px 14px",fontSize:12.5}} onClick={()=>setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="log-wrap">
          <table className="log-table">
            <thead><tr><th>Time</th><th>Event</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>
              {filteredLogs.length === 0 && <tr><td colSpan={4} className="empty-t">No matching events.</td></tr>}
              {filteredLogs.map(l => (
                <tr key={l.id}>
                  <td className="mono">{new Date(l.timestamp).toLocaleString()}</td>
                  <td style={{textTransform:"capitalize"}}>{l.event_type.replace(/_/g," ")}</td>
                  <td><span className={`risk-badge rb-${(l.risk_level||"low").toLowerCase()}`}>{l.risk_level}</span></td>
                  <td><span className={`sp-pill sp-${l.status.toLowerCase()}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
