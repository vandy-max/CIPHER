import { useEffect, useState } from "react";
import { Bell, Menu } from "lucide-react";

const PAGE_TITLES = {
  dashboard: ["Dashboard", "Bank-wide security posture at a glance"],
  request:   ["Access Request", "Request privileged access to a protected resource"],
  send:      ["Secure Send", "Send a protected, intent-bound record"],
  received:  ["Received Records", "Records shared with you"],
  activity:  ["Security Activity", "Your intent · quantum · risk · identity audit trail"],
  soc:       ["Threat Detection Center", "Bank-wide access decisions & insider-risk distribution"],
  account:   ["Account & Security", "Profile and face identity enrollment"],
};

export default function Header({ user, currentPage, onOpenMobileNav }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [title, subtitle] = PAGE_TITLES[currentPage] || ["CipherQ", "Banking Security Platform"];

  return (
    <header className="topheader">
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <button className="th-bell mobile-nav-btn" onClick={onOpenMobileNav} style={{ display: "none" }}>
          <Menu size={17} />
        </button>
        <div className="th-title">
          <span className="th-title-main">{title}</span>
          <span className="th-title-sub">{subtitle}</span>
        </div>
      </div>

      <div className="th-right">
        <span className="th-clock">
          {now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {now.toLocaleTimeString()}
        </span>
        <button className="th-bell" title="Notifications">
          <Bell size={16} />
          <span className="th-bell-dot" />
        </button>
        <div className="th-user">
          <div className="th-user-meta">
            <span className="th-user-name">{user?.username}</span>
            <span className="th-user-role">{user?.role?.replace(/_/g, " ") || "—"}</span>
          </div>
          <div className="user-badge">{user?.username?.[0]?.toUpperCase()}</div>
        </div>
      </div>
    </header>
  );
}
