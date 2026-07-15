import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getDashboardStats } from "../services/api";

const SOC_ROLES = ["SECURITY_ANALYST", "SYSTEM_ADMIN", "DATABASE_ADMIN", "AUDITOR"];

const BASE_CARDS = [
  { id:"request",  icon:"◆", title:"Access Request",     desc:"Request privileged access to protected banking resources secured by CipherQ.", tag:"Start here", color:"c-violet" }, // No change needed
  { id:"send",     icon:"⬡", title:"Secure Send",       desc:"Send protected banking information to a registered CipherQ user, bound to your declared intent", tag:"Messaging", color:"c-indigo" },
  { id:"received", icon:"◫", title:"Received Records",   desc:"Open records sent to you — CipherQ verifies context and identity before revealing anything",       tag:"Inbox",      color:"c-peach"  },
  { id:"activity", icon:"▲", title:"Security Activity",  desc:"Every authorization, business intent, quantum verification, and identity verification event performed by CipherQ.", tag:"Audit trail",color:"c-amber"  },
  { id:"account",  icon:"◉", title:"Account & Security", desc:"Manage your profile and the face identity template used for verification.",                   tag:"Profile",    color:"c-sky"    },
];

const SOC_CARD = { id:"soc", icon:"■", title:"Threat Detection Center", desc:"Bank-wide access requests, allow/deny decisions, insider-risk distribution, roles and recent security events", tag:"Insider Threat", color:"c-rose" };

export default function Dashboard({ navigate, user }) {
  const [stats, setStats]   = useState(null);
  const [visible, setVis]   = useState(false);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error);
    setTimeout(() => setVis(true), 60);
  }, []);

  const fade = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translateY(14px)",
    transition: `opacity .5s ${delay}s, transform .5s ${delay}s`,
  });

  const cards = SOC_ROLES.includes(user?.role) ? [...BASE_CARDS, SOC_CARD] : BASE_CARDS;

  return (
    <div className="page">
      <div className="dash-header" style={fade(0)}>
        <div className="ph" style={{margin:0}}>
          <h1>Welcome back, <span className="grad">{user?.username}</span></h1>
          <p style={{color:"var(--text2)",marginTop:6,fontSize:15}}>CipherQ Banking Security Platform</p>
        </div>
      </div>

      {stats && (
        <div className="stats-row" style={fade(0.08)}>
          {[
            { label:"My Access Requests",       value: stats.my_access_requests,                          icon:"◆" },
            { label:"Records Sent",             value: stats.protected_records_sent,                     icon:"⬡" },
            { label:"Quantum Channel Integrity",value: `${(100 - stats.average_qber * 100).toFixed(2)}%`, icon:"◈" },
            { label:"Security Status",            value: stats.face_enrolled ? "Verified" : "Incomplete",icon:"◉" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value" style={{fontSize: typeof s.value === "string" ? 17 : 24}}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card c-sky" style={{...fade(0.08)}}>
        <h2 style={{marginTop:0, marginBottom:16}}>Your Profile</h2>
        <div className="kv-row"><span className="kv-label">Role</span><span className="badge b-info">{user?.role?.replace(/_/g," ")}</span></div>
        <div className="kv-row"><span className="kv-label">Department</span><span className="kv-value">{user?.department || "—"}</span></div>
        <div className="kv-row"><span className="kv-label">Privilege Level</span><span className="badge b-info">L{user?.privilege_level ?? "—"}</span></div>
        <div className="kv-row"><span className="kv-label">Account Status</span><span className="badge b-success">Active</span></div>
      </div>

      {stats && !stats.face_enrolled && (
        <div className="card c-amber" style={{...fade(0.12), display:"flex", alignItems:"center", gap:16, padding:20, cursor:"pointer"}}
             onClick={() => navigate("account")}>
          <span style={{fontSize:26}}>◉</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14.5,marginBottom:3}}>Face identity not enrolled</div>
            <div style={{fontSize:13,color:"var(--text2)"}}>
              The CipherQ Banking Security Platform requires face identity verification for every privileged access request and for sending or opening Protected
              Records — a core control against credential misuse. Enroll
              from Account & Security to unlock Access Request, Secure Send and Received Records.
            </div>
          </div>
          <div className="ac-arr">→</div>
        </div>
      )}

      <div className="card-grid" style={fade(0.16)}>
        {cards.map((card, i) => (
          <div
            key={card.id}
            className={`card ${card.color} clickable`}
            onClick={() => navigate(card.id)}
            style={{ transitionDelay: `${i * 0.05}s` }}
          >
            <div className="ac-icon">{card.icon}</div>
            <h3 className="ac-title">{card.title}</h3>
            <p className="ac-desc">{card.desc}</p>
            <div className="ac-footer">
              <span className="ac-tag">{card.tag}</span>
              <div className="ac-arr">→</div>
            </div>
          </div>
        ))}
      </div>

      {stats?.recent_events?.length > 0 && (
        <div className="card c-indigo" style={fade(0.24)}>
          <h2>Recent Security Activity</h2>
          <div className="ev-list">
            {stats.recent_events.slice(0, 6).map(ev => (
              <div key={ev.id} className="ev-row">
                <span className={`ev-dot ${ev.risk_level.toLowerCase()}`}></span>
                <span className="ev-type">{ev.event_type.replace(/_/g, " ")}</span>
                <span className={`sp-pill sp-${ev.status.toLowerCase()}`}>{ev.status}</span>
                <span className="ev-time">{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:14}}>
            <button className="btn btn-ghost" onClick={() => navigate("activity")}>View all activity →</button>
          </div>
        </div>
      )}
    </div>
  );
}
