import {
  LayoutDashboard, ShieldCheck, SendHorizonal, Inbox, Activity,
  ShieldAlert, UserCog, LogOut, ChevronsLeft, ChevronsRight, ShieldHalf,
} from "lucide-react";

const SOC_ROLES = ["SECURITY_ANALYST", "SYSTEM_ADMIN", "DATABASE_ADMIN", "AUDITOR"];

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Security Operations",
    items: [
      { id: "request",  label: "Access Request",     icon: ShieldCheck },
      { id: "send",     label: "Secure Send",         icon: SendHorizonal },
      { id: "received", label: "Received Records",    icon: Inbox },
      { id: "activity", label: "Security Activity",   icon: Activity },
      { id: "soc",      label: "Threat Detection Center", icon: ShieldAlert, socOnly: true },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "account", label: "Account & Security", icon: UserCog },
    ],
  },
];

export default function Sidebar({ user, navigate, logout, currentPage, collapsed, setCollapsed, mobileOpen, closeMobile }) {
  const isSoc = SOC_ROLES.includes(user?.role);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sb-brand" onClick={() => { navigate("dashboard"); closeMobile?.(); }}>
        <div className="brand-icon"><ShieldHalf size={17} strokeWidth={2.4} /></div>
        <div className="sb-brand-text">
          <span className="brand-text">CipherQ</span>
          <span className="brand-tag">Banking Security Platform</span>
        </div>
      </div>

      <button className="sb-toggle" onClick={() => setCollapsed(c => !c)} title={collapsed ? "Expand" : "Collapse"}>
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>

      <nav className="sb-nav">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <div className="sb-section-lbl">{section.label}</div>
            {section.items
              .filter(item => !item.socOnly || isSoc)
              .map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`sb-link ${currentPage === item.id ? "active" : ""}`}
                    onClick={() => { navigate(item.id); closeMobile?.(); }}
                    title={item.label}
                  >
                    <Icon size={17} strokeWidth={2} />
                    <span className="sb-link-label">{item.label}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        <button className="sb-link" onClick={logout} title="Sign out">
          <LogOut size={17} strokeWidth={2} />
          <span className="sb-link-label">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
