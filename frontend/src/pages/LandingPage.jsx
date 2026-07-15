import { useEffect, useRef } from "react";
import {
  ShieldHalf, ShieldCheck, Fingerprint, Atom, ShieldAlert, ScanFace,
  Building2, Users, Database, KeyRound, ArrowRight,
} from "lucide-react";

const STATS = [
  { icon: Users,     value: "6",      label: "Banking Roles • RBAC Enforced" },
  { icon: Database,  value: "Protected Banking Resources",  label: "Role-Based Authorization" },
  { icon: Atom,      value: "256-bit BB84",    label: "Quantum Key Exchange" },
  { icon: KeyRound,  value: "AES-256 Encryption", label: "Face Identity Match" },
];

const WORKFLOW = [
  { icon: Building2,     title: "Select Resource",     desc: "Choose a protected banking resource before initiating privileged access." },
  { icon: ShieldCheck,   title: "RBAC Validation",      desc: "Verify user role and privilege level before any security operation begins." },
  { icon: Fingerprint,   title: "Business Intent",      desc: "Business intent is securely generated and validated before privileged access." },
  { icon: Atom,          title: "Quantum Key Exchange", desc: "Generate a BB84 quantum key using Qiskit before sensitive operations." },
  { icon: ShieldAlert,   title: "Risk Evaluation",      desc: "Behavioral and contextual risk scoring evaluates every privileged request." },
  { icon: ScanFace,      title: "Face Identity Match",  desc: "Verify the user's enrolled facial identity before granting access." },
];

const PILLARS = [
  {
    title: "The insider threat",
    body: "Banking systems verify who staff members are, but privileged roles can still grant broad access to customer records, transactions, loans, and treasury data. A compromised session, an overprivileged role, or a malicious insider can expose sensitive systems beyond what any single action requires.",
  },
  {
    title: "The CipherQ approach",
    body: "Every privileged request begins with RBAC and privilege checks. If it passes, the request is bound to a fresh quantum key, a hashed statement of intent, and an adaptive risk score — and still requires a face identity match, so role and password alone are never enough.",
  },
];

export default function LandingPage({ navigate, isAuthenticated }) {
  const meshRef = useRef(null);

  useEffect(() => {
    const el = meshRef.current;
    if (!el) return;
    let raf;
    let t = 0;
    const tick = () => {
      t += 0.0016;
      const x1 = 50 + Math.sin(t) * 8;
      const y1 = 18 + Math.cos(t * 0.8) * 6;
      const x2 = 82 + Math.cos(t * 0.6) * 6;
      const y2 = 60 + Math.sin(t * 0.7) * 8;
      el.style.background =
        `radial-gradient(600px circle at ${x1}% ${y1}%, rgba(0,82,204,.07), transparent 60%),` +
        `radial-gradient(560px circle at ${x2}% ${y2}%, rgba(14,165,233,.08), transparent 60%),` +
        `radial-gradient(900px circle at 10% 90%, rgba(37,99,235,.05), transparent 60%)`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="landing-lt">
      <div className="landing-lt-mesh" ref={meshRef} />
      <div className="landing-lt-grid" />

      <header className="landing-lt-nav">
        <div className="landing-lt-brand">
          <div className="brand-icon"><ShieldHalf size={17} strokeWidth={2.4} /></div>
          <div>
            <span className="brand-text-dark">CipherQ</span>
            <span className="brand-tag-dark">Banking Insider Threat Detection Platform</span>
          </div>
        </div>
        <div className="landing-lt-nav-cta">
          {isAuthenticated ? (
            <button className="btn btn-primary" onClick={() => navigate("dashboard")}>Open Dashboard</button>
          ) : (
            <>
              <button className="btn-text" onClick={() => navigate("login")}>Sign in</button>
              <button className="btn btn-primary" onClick={() => navigate("register")}>Get started</button>
            </>
          )}
        </div>
      </header>

      <section className="landing-lt-hero">
        <div className="landing-lt-chip">
          <span className="chip-dot-lt" />
          Intent-Based Access Security
        </div>

        <h1 className="landing-lt-title">
          Zero-Trust Access Security for<br className="hide-mobile" /> Modern Banking Systems
        </h1>

        <p className="landing-lt-sub">
          CipherQ secures privileged banking access using role-based authorization, business intent validation, BB84 quantum key exchange, adaptive risk scoring, and face identity verification before granting access to protected banking resources. Every decision is securely logged for complete auditability.
        </p>

        <div className="landing-lt-cta">
          {isAuthenticated ? (
            <button className="btn btn-primary btn-lg" onClick={() => navigate("dashboard")}>
              Open Dashboard <ArrowRight size={16} />
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-lg" onClick={() => navigate("register")}>
                Get started <ArrowRight size={16} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => navigate("login")}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="landing-lt-stats">
          {STATS.map(s => (
            <div key={s.label} className="stat-card-lt">
              <div className="stat-card-icon"><s.icon size={18} strokeWidth={2} /></div>
              <div>
                <div className="stat-card-value">{s.value}</div>
                <div className="stat-card-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-lt-flow">
        <div className="section-eyebrow">How an access request is decided</div>
        <h2 className="section-heading">Six checks. Every time. No exceptions.</h2>
        <p className="section-sub">
          The same pipeline runs for every privileged request, in this order — a failure at any
          step stops the request before a protected resource is ever revealed.
        </p>

        <div className="flow-rail">
          {WORKFLOW.map((step, i) => (
            <div className="flow-node" key={step.title}>
              <div className="flow-node-top">
                <div className="flow-node-icon"><step.icon size={19} strokeWidth={2} /></div>
                <div className="flow-node-num">{String(i + 1).padStart(2, "0")}</div>
              </div>
              <div className="flow-node-title">{step.title}</div>
              <div className="flow-node-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-lt-pillars">
        {PILLARS.map(p => (
          <div className="pillar-card" key={p.title}>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </div>
        ))}
      </section>

      <section className="landing-lt-final">
        <div className="landing-lt-final-inner">
          <h2>Every decision lands on the Threat Detection Center in real time.</h2>
          <p>Role, intent, quantum channel integrity, risk score, and face identity — logged and auditable for every request.</p>
          {isAuthenticated ? (
            <button className="btn btn-primary btn-lg" onClick={() => navigate("dashboard")}>
              Open Dashboard <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={() => navigate("register")}>
              Get started <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>

      <footer className="landing-lt-footer">
        <div className="landing-lt-footer-brand">
          <div className="brand-icon small"><ShieldHalf size={14} strokeWidth={2.4} /></div>
          <span>CipherQ Banking Security Platform</span>
        </div>
        <div className="landing-lt-footer-links">
          <button className="btn-text" onClick={() => navigate("login")}>Sign in</button>
          <button className="btn-text" onClick={() => navigate("register")}>Create account</button>
        </div>
        <div className="landing-lt-footer-fine">
          Intent-bound · RBAC-enforced · Quantum-safe · Face-verified access control.
        </div>
      </footer>
    </div>
  );
}
