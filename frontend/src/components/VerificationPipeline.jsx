/**
 * VerificationPipeline.jsx
 * -------------------------
 * The signature visual for CipherQ: shows the real, live status of every
 * security check a transaction goes through, in order. Each node's state
 * ("pending" | "active" | "pass" | "fail") is driven directly by the actual
 * backend calls made during the transaction flow (quantum key generation,
 * face-api.js expression check, intent hash binding, risk scoring) —
 * nothing here is simulated independently of those real results.
 */
const DEFAULT_STAGES = [
  { key:"initiated", icon:"▤", label:"Transaction Initiated" },
  { key:"intent",    icon:"◈", label:"Intent Analysis" },
  { key:"context",   icon:"◎", label:"Context Verification" },
  { key:"biometric", icon:"◉", label:"Behavioral / Facial Signal" },
  { key:"quantum",   icon:"⬡", label:"Quantum Key Security" },
  { key:"risk",      icon:"▲", label:"Risk Evaluation" },
];

export default function VerificationPipeline({ stages = DEFAULT_STAGES, status = {} }) {
  return (
    <div className="pipeline">
      {stages.map(s => {
        const st = status[s.key] || "pending"; // pending | active | pass | fail
        const icon = st === "pass" ? "✓" : st === "fail" ? "✗" : s.icon;
        return (
          <div key={s.key} className={`pl-node ${st}`}>
            <div className="pl-dot">{icon}</div>
            <span className="pl-label">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export { DEFAULT_STAGES };
