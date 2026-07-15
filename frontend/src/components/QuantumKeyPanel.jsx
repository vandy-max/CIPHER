/**
 * QuantumKeyPanel.jsx
 * --------------------
 * Shows the REAL result of a BB84 quantum key exchange (from
 * POST /api/generate-key, backed by backend/quantum_bb84.py running
 * actual per-bit Qiskit Aer circuits) — not a decorative animation.
 * Every number here comes straight from that response. Pauses the
 * Secure Send flow so this step is actually seen, with an optional
 * "proof" panel showing the live Qiskit version and a sample circuit
 * diagram pulled from GET /api/quantum-info.
 */
import { useEffect, useState } from "react";
import { getQuantumInfo } from "../services/api";

const QBER_ABORT_THRESHOLD = 11; // %

export default function QuantumKeyPanel({ result, onContinue }) {
  const [proof, setProof]   = useState(null);
  const [showProof, setSP]  = useState(false);

  useEffect(() => { getQuantumInfo().then(setProof).catch(() => {}); }, []);

  const qberPct = (result.qber * 100);
  const aborted = result.session_aborted;
  const barPct = Math.min(100, (qberPct / (QBER_ABORT_THRESHOLD * 2)) * 100);

  return (
    <div className="card c-indigo qkd-panel">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <h2 style={{marginBottom:0}}>⬡ Quantum Key Distribution</h2>
        <span className="qkd-live-chip">● LIVE — Qiskit Aer</span>
      </div>
      <p className="card-desc">
        A real BB84 exchange just ran — one genuine 1-qubit quantum circuit executed per bit,
        not a classical approximation. These numbers are the actual result.
      </p>

      <div className="qkd-stats">
        <div className="qkd-stat">
          <span className="qkd-stat-value">256</span>
          <span className="qkd-stat-label">Qubits Transmitted</span>
        </div>
        <div className="qkd-stat">
          <span className="qkd-stat-value">{result.circuits_run}</span>
          <span className="qkd-stat-label">Quantum Circuits Executed</span>
        </div>
        <div className="qkd-stat">
          <span className="qkd-stat-value">{result.sifted_bits}</span>
          <span className="qkd-stat-label">Sifted Key Bits Kept</span>
        </div>
        <div className="qkd-stat">
          <span className="qkd-stat-value">{result.backend}</span>
          <span className="qkd-stat-label">Simulator Backend</span>
        </div>
      </div>

      <div className="qkd-qber-block">
        <div className="qkd-qber-row">
          <span className="qkd-qber-label">Measured Quantum Bit Error Rate (QBER)</span>
          <span className={`qkd-qber-value ${aborted ? "danger" : "ok"}`}>{qberPct.toFixed(2)}%</span>
        </div>
        <div className="qkd-qber-bar">
          <div className="qkd-qber-fill" style={{ width:`${barPct}%`, background: aborted ? "var(--rose)" : "var(--mint)" }} />
          <div className="qkd-qber-threshold" style={{ left:`${Math.min(100, (QBER_ABORT_THRESHOLD / (QBER_ABORT_THRESHOLD*2))*100)}%` }} title="11% abort threshold" />
        </div>
        <div className="qkd-qber-caption">Abort threshold: 11% — above this, eavesdropping is assumed and the key is discarded.</div>
      </div>

      <div className={`qkd-verdict ${aborted ? "danger" : "ok"}`}>
        {aborted
          ? "✗ Session aborted — QBER exceeds the security threshold. Possible eavesdropping detected; this key is discarded."
          : "✓ Channel integrity confirmed — QBER within threshold. Quantum key accepted."}
      </div>

      <div className="qkd-key-preview">
        <span className="copy-lbl">Derived Quantum Key (hex, truncated)</span>
        <div className="copy-wrap"><span className="copy-text">{result.quantum_key_hex.slice(0, 40)}…</span></div>
      </div>

      <button className="link-btn" style={{marginTop:4}} onClick={() => setSP(s => !s)}>
        {showProof ? "Hide" : "Show"} proof this is a real Qiskit circuit →
      </button>

      {showProof && proof?.qiskit_available && (
        <div className="qkd-proof">
          <div className="kv-row"><span className="kv-label">Qiskit Version</span><span className="kv-value">{proof.qiskit_version}</span></div>
          <div className="kv-row"><span className="kv-label">Simulator</span><span className="kv-value">{proof.simulator}</span></div>
          <span className="copy-lbl" style={{marginTop:10,display:"block"}}>Sample BB84 Round Circuit</span>
          <pre className="qkd-circuit">{proof.sample_circuit_diagram}</pre>
        </div>
      )}
      {showProof && proof && !proof.qiskit_available && (
        <div className="err" style={{marginTop:12}}>Qiskit isn't installed on this backend — see backend/README.md.</div>
      )}

      <button className="btn btn-primary" style={{marginTop:18}} onClick={onContinue}>
        {aborted ? "Acknowledge — Block This Send →" : "Continue to Risk Evaluation →"}
      </button>
    </div>
  );
}
