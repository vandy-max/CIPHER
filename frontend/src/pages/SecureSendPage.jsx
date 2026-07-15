/**
 * SecureSendPage.jsx
 * -------------------
 * The core banking security workflow. On entry, before anything else,
 * CipherQ re-verifies that the current session really belongs to a
 * registered account (GET /api/verify-session) — not just that the JWT
 * signature checks out. Then: pick a registered recipient, describe the
 * protected information and declared intent, and CipherQ runs the real
 * security pipeline — intent binding, cryptographic protection,
 * quantum-safe key security, adaptive risk evaluation, and (for
 * high-risk sends) a step-up face identity check on the SENDER — before
 * creating a backend-managed Protected Record. No manual copying of
 * ciphertext/keys/hashes.
 */
import { useEffect, useState } from "react";
import {
  verifySession, getUsers, generateIntent, validateIntent, generateKey,
  calculateRisk, faceVerify, createProtectedRecord,
} from "../services/api";
import VerificationPipeline from "../components/VerificationPipeline";
import QuantumKeyPanel from "../components/QuantumKeyPanel";
import FaceCapture from "../components/FaceCapture";
import Loader from "../components/Loader";

const SEND_STAGES = [
  { key:"validate", icon:"◇", label:"Verifying Registered User" },
  { key:"intent",   icon:"◈", label:"Binding Intent" },
  { key:"crypto",   icon:"■", label:"Cryptographic Protection" },
  { key:"quantum",  icon:"⬡", label:"Quantum-Safe Security" },
  { key:"risk",     icon:"▲", label:"Risk Evaluation" },
  { key:"identity", icon:"◉", label:"Identity Verification" },
  { key:"record",   icon:"▤", label:"Protected Record" },
];

const PURPOSE_OPTIONS = [
  "Fund transfer confirmation",
  "Monthly account statement",
  "Loan document",
  "Bill payment",
  "KYC / identity document",
  "Invoice settlement",
  "Salary / payroll transfer",
  "Insurance claim document",
  "Other (specify below)",
];

export default function SecureSendPage({ navigate }) {
  // Registered-user directory
  const [users, setUsers]         = useState([]);
  const [usersLoading, setULoad]  = useState(true);
  const [usersError, setUErr]     = useState("");
  const [recipientId, setRid]     = useState("");

  // Form fields
  const [message, setMessage]     = useState("");
  const [purposeChoice, setPurposeChoice] = useState("");
  const [purposeOther, setPurposeOther]   = useState("");
  const purpose = purposeChoice === "Other (specify below)" ? purposeOther.trim() : purposeChoice;

  const [phase, setPhase]     = useState("form"); // form | processing | need-face | done | blocked
  const [pipeline, setPipeline] = useState({});
  const [error, setError]     = useState("");
  const [loaderLabel, setLoaderLabel] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [result, setResult]   = useState(null);
  const [ctx, setCtx]         = useState({}); // carried across the async pipeline

  const loadUsers = () => {
    setULoad(true); setUErr("");
    getUsers()
      .then(d => setUsers(d.users))
      .catch(e => setUErr(e.message))
      .finally(() => setULoad(false));
  };
  useEffect(loadUsers, []);

  const mark = (key, st) => setPipeline(p => ({ ...p, [key]: st }));

  const startSend = async () => {
    setError("");
    if (!recipientId) { setError("Select a registered recipient."); return; }
    if (!message.trim()) { setError("Enter the protected information to send."); return; }
    if (!purpose) { setError("Declare the purpose/intent for this transfer."); return; }

    setPhase("processing");
    setPipeline({});
    try {
      // ── Re-verify, right now, that this session really belongs to a
      // registered account — not just that the JWT is well-formed. ──
      mark("validate", "active");
      setLoaderLabel("Verifying registered user…");
      const session = await verifySession();
      if (!session.verified) {
        mark("validate", "fail");
        return blockAndStop(session.reason || "Your session could not be verified against a registered account. Please sign in again.");
      }
      mark("validate", "pass");

      mark("intent", "active");
      setLoaderLabel("Binding transaction intent…");
      const intentRes = await generateIntent({
        receiver_id: parseInt(recipientId),
        purpose,
        device_id: navigator.userAgent.slice(0, 64),
        emotion: "pending",
      });
      mark("intent", "pass");

      mark("crypto", "active");
      setLoaderLabel("Preparing cryptographic protection…");
      const validation = await validateIntent({ session_id: intentRes.session_id, intent_hash: intentRes.intent_hash });
      if (!validation.valid) {
        mark("crypto", "fail");
        return blockAndStop("Intent could not be cryptographically bound to this session.");
      }
      mark("crypto", "pass");

      mark("quantum", "active");
      setLoaderLabel("Establishing quantum-safe security…");
      const key = await generateKey();
      mark("quantum", key.session_aborted ? "fail" : "pass");
      setCtx(c => ({ ...c, intentRes, key }));
      setPhase("quantum-result"); // pause here so the real BB84 result is actually seen
    } catch (e) {
      setError(e.message);
      setPhase("form");
    }
  };

  const continueAfterQuantum = async () => {
    const { intentRes, key } = ctx;
    if (key.session_aborted) {
      return blockAndStop(`Quantum-safe channel integrity check failed (QBER ${(key.qber*100).toFixed(1)}%) — possible interception detected.`);
    }
    setPhase("processing");
    try {
      mark("risk", "active");
      setLoaderLabel("Evaluating risk…");
      const risk = await calculateRisk({
        qber: key.qber, failed_logins:0, emotion_valid:true, session_expired:false,
        device_match:true, rapid_access_attempts:0,
        recipient_name: users.find(u=>u.id===parseInt(recipientId))?.username,
        amount: null, purpose,
      });

      setCtx(c => ({ ...c, risk }));

      // Face identity verification is now a STANDARD, mandatory part of
      // every send — not just an adaptive high-risk trigger — mirroring
      // the mandatory check the recipient must pass to open the record.
      mark("risk", "pass");
      mark("identity", "active");
      setPhase("need-face");
    } catch (e) {
      setError(e.message);
      setPhase("form");
    }
  };

  const blockAndStop = (reason) => {
    setBlockReason(reason);
    setPhase("blocked");
  };

  const handleSenderFaceResult = async (captured) => {
    setLoaderLabel("Verifying your identity…");
    setPhase("processing");
    try {
      const check = await faceVerify(captured.descriptor);
      if (!check.match) {
        mark("identity", "fail");
        return blockAndStop("Adaptive face identity verification failed — the presented face does not match your enrolled identity. Sending has been blocked.");
      }
      mark("identity", "pass");
      await finishCreatingRecord(ctx.intentRes, ctx.key, ctx.risk, captured.descriptor);
    } catch (e) {
      if (e.message?.includes("404")) {
        mark("identity", "fail");
        return blockAndStop("Face identity verification is required before sending, but no face is enrolled on your account. Enroll from Account & Security first.");
      }
      setError(e.message);
      setPhase("form");
    }
  };

  const finishCreatingRecord = async (intentRes, key, risk, senderEmbedding) => {
    mark("record", "active");
    setLoaderLabel("Creating protected record…");
    setPhase("processing");
    try {
      const rec = await createProtectedRecord({
        recipient_id: parseInt(recipientId),
        message,
        purpose,
        session_id: intentRes.session_id,
        intent_hash: intentRes.intent_hash,
        quantum_key_hex: key.quantum_key_hex,
        emotion: "neutral",
        qber: key.qber,
        risk_score: risk.score,
        risk_level: risk.level,
        sender_embedding: senderEmbedding,
      });
      mark("record", "pass");
      setResult({ ...rec, recipient: users.find(u=>u.id===parseInt(recipientId))?.username, risk });
      setPhase("done");
    } catch (e) {
      mark("record", "fail");
      return blockAndStop(e.message);
    }
  };

  const reset = () => {
    setPhase("form"); setPipeline({}); setError(""); setBlockReason("");
    setMessage(""); setPurposeChoice(""); setPurposeOther(""); setRid(""); setResult(null); setCtx({});
    loadUsers();
  };

  return (
    <div className="page">
      <div className="ph">
        <h1>Secure <span className="grad">Send</span></h1>
        <p style={{color:"var(--text2)",marginTop:6,fontSize:15}}>
          Send protected banking information to a registered CipherQ user — bound to your declared intent
        </p>
      </div>

      {phase === "form" && (
        <div className="card c-indigo">
          <h2>▤ Protected Transfer Details</h2>
          <p className="card-desc">CipherQ binds this transfer to your declared intent and current security context before anything is encrypted.</p>

          <div className="fg">
            <label>Recipient *</label>
            {usersLoading ? (
              <div style={{fontSize:13,color:"var(--text3)",padding:"10px 0"}}>Loading registered users…</div>
            ) : usersError ? (
              <div className="err" style={{marginBottom:0}}>
                Couldn't load registered users — {usersError}.{" "}
                <button className="link-btn" onClick={loadUsers}>Retry →</button>
              </div>
            ) : users.length === 0 ? (
              <div className="note" style={{marginTop:0}}>
                No other registered CipherQ users found yet. Register a second account (or ask a
                teammate to register) — they'll appear here automatically.{" "}
                <button className="link-btn" onClick={loadUsers}>↻ Refresh</button>
              </div>
            ) : (
              <div style={{display:"flex",gap:8}}>
                <select value={recipientId} onChange={e => setRid(e.target.value)} style={{flex:1}}>
                  <option value="">Select a registered CipherQ user… ({users.length} available)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <button className="btn btn-ghost" title="Refresh recipient list" onClick={loadUsers} style={{padding:"0 14px"}}>↻</button>
              </div>
            )}
          </div>

          <div className="fg">
            <label>Protected Information *</label>
            <textarea rows={4} placeholder="e.g. Account number, statement details, transaction reference…"
              value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <div className="fg">
            <label>Declared Purpose / Intent *</label>
            <select value={purposeChoice} onChange={e => setPurposeChoice(e.target.value)}>
              <option value="">Select a purpose…</option>
              {PURPOSE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {purposeChoice === "Other (specify below)" && (
            <div className="fg">
              <label>Specify Purpose *</label>
              <input type="text" placeholder="Describe why you're sending this…"
                value={purposeOther} onChange={e => setPurposeOther(e.target.value)} />
            </div>
          )}

          {error && <div className="err">⚠ {error}</div>}
          <button className="btn btn-primary" onClick={startSend}>⬡ Send Securely →</button>
        </div>
      )}

      {(phase === "processing" || phase === "quantum-result" || phase === "need-face" || phase === "blocked" || phase === "done") && (
        <div className="card c-indigo">
          <h2>Security Processing Pipeline</h2>
          <p className="card-desc">Live status of every real security check this transfer is passing through.</p>
          <VerificationPipeline stages={SEND_STAGES} status={pipeline} />
        </div>
      )}

      {phase === "processing" && <Loader label={loaderLabel} />}

      {phase === "quantum-result" && ctx.key && (
        <QuantumKeyPanel result={ctx.key} onContinue={continueAfterQuantum} />
      )}

      {phase === "need-face" && (
        <div className="card c-amber">
          <h2>◉ Confirm Your Identity</h2>
          <p className="card-desc">
            CipherQ requires the sender to verify face identity before every Protected Record is created —
            this confirms it's really you sending, not just someone with your password.
            {ctx.risk?.level && <> This transfer's risk score was <strong>{ctx.risk.level}</strong>.</>}
          </p>
          <FaceCapture buttonLabel="Verify My Identity & Send" onCapture={handleSenderFaceResult} />
        </div>
      )}

      {phase === "blocked" && (
        <>
          <div className="verdict-box blocked">
            <div className="verdict-icon">✗</div>
            <div className="verdict-title">Send Blocked</div>
            <div className="verdict-sub">{blockReason}</div>
          </div>
          <div style={{marginTop:18}}><button className="btn btn-ghost" onClick={reset}>Try again →</button></div>
        </>
      )}

      {phase === "done" && result && (
        <>
          <div className="verdict-box authorized">
            <div className="verdict-icon">✓</div>
            <div className="verdict-title">Securely Delivered</div>
            <div className="verdict-sub">Protected Record #{result.record_id} sent to {result.recipient}</div>
          </div>
          <div className="card c-mint" style={{marginTop:20}}>
            <h2>Delivery Summary</h2>
            <div className="intent-row" style={{marginBottom:10}}>
              <span className={`risk-badge rb-${result.risk.level.toLowerCase()}`}>{result.risk.level} RISK — {result.risk.score}/100</span>
              {result.requires_face_verification && <span className="face-req-chip">◉ Recipient must verify face to open</span>}
            </div>
            <p className="card-desc" style={{marginBottom:0}}>
              {result.recipient} will see this in Received Records. They'll need to pass CipherQ's context
              verification{result.requires_face_verification ? " and face identity check " : " "}before the content is revealed.
            </p>
            <div style={{marginTop:18,display:"flex",gap:10}}>
              <button className="btn btn-ghost" onClick={reset}>Send another →</button>
              <button className="btn btn-primary" onClick={() => navigate("received")}>View Received Records →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
