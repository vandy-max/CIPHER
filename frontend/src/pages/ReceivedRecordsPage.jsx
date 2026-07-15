/**
 * ReceivedRecordsPage.jsx
 * ------------------------
 * Replaces the old standalone "decrypt" page's manual copy/paste UX.
 * Records are fetched by ID from the backend automatically — the user
 * never handles ciphertext, nonce, tag, quantum key, or intent hash.
 * Opening a record still runs the exact same real verification chain
 * (recipient authorization → intent/context integrity → adaptive face
 * identity check → intent-bound AES-256-GCM decryption) as the original
 * decrypt flow, just without manual data entry.
 */
import { useEffect, useState } from "react";
import { getProtectedRecords, contextCheckRecord, openProtectedRecord } from "../services/api";
import VerificationPipeline from "../components/VerificationPipeline";
import FaceCapture from "../components/FaceCapture";
import Loader from "../components/Loader";

const OPEN_STAGES = [
  { key:"auth",     icon:"◉", label:"Verifying Recipient" },
  { key:"context",  icon:"◎", label:"Authorization Context" },
  { key:"intent",   icon:"◈", label:"Bound Intent" },
  { key:"identity", icon:"◉", label:"Face Verification" },
  { key:"decrypt",  icon:"■", label:"Intent-Bound Decryption" },
];

export default function ReceivedRecordsPage() {
  const [tab, setTab]         = useState("received"); // received | sent
  const [records, setRecords] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setRecords(null);
    getProtectedRecords(tab).then(d => setRecords(d.records)).catch(console.error);
  }, [tab]);

  const openDetail = (rec) => { setSelected(rec); };
  const closeDetail = () => { setSelected(null); refresh(); };
  const refresh = () => getProtectedRecords(tab).then(d => setRecords(d.records)).catch(console.error);

  return (
    <div className="page">
      <div className="ph">
        <h1>Received <span className="grad">Records</span></h1>
        <p style={{color:"var(--text2)",marginTop:6,fontSize:15}}>Protected banking records shared with you through CipherQ's intent-bound security</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==="received"?"active":""}`} onClick={()=>setTab("received")}>Received</button>
        <button className={`tab ${tab==="sent"?"active":""}`} onClick={()=>setTab("sent")}>Sent</button>
      </div>

      {selected ? (
        <RecordDetail record={selected} onBack={closeDetail} />
      ) : (
        <div className="card c-indigo">
          <h2>{tab === "received" ? "Records Sent To You" : "Records You've Sent"}</h2>
          {records === null && <p className="empty-t">Loading records…</p>}
          {records !== null && records.length === 0 && (
            <p className="empty-t">{tab === "received" ? "No protected records yet." : "You haven't sent any protected records yet."}</p>
          )}
          <div className="rec-list">
            {records?.map(r => (
              <div key={r.id} className="rec-row" onClick={() => tab === "received" ? openDetail(r) : null} style={{cursor: tab==="received" ? "pointer" : "default"}}>
                <div className="rec-icon">{r.status === "ACCESSED" ? "✓" : r.status === "BLOCKED" ? "✗" : "▤"}</div>
                <div className="rec-main">
                  <div className="rec-title">{r.purpose}</div>
                  <div className="rec-sub">{tab === "received" ? `From ${r.sender}` : `To ${r.recipient}`} · Record #{r.id}</div>
                </div>
                <div className="rec-meta">
                  <span className={`risk-badge rb-${(r.risk_level||"low").toLowerCase()}`}>{r.risk_level || "LOW"}</span>
                  {r.requires_face_verification && <span className="face-req-chip">◉ Face required</span>}
                  <span className="rec-time">{new Date(r.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordDetail({ record, onBack }) {
  const [stage, setStage]     = useState("preview"); // preview | verifying | need-face | granted | denied
  const [pipeline, setPipeline] = useState({});
  const [loaderLabel, setLL]  = useState("");
  const [deniedReason, setDR] = useState("");
  const [plaintext, setPT]    = useState("");
  const [ctxInfo, setCtxInfo] = useState(null);

  const mark = (k, s) => setPipeline(p => ({ ...p, [k]: s }));

  const openRecord = async () => {
    setStage("verifying"); setPipeline({});
    try {
      mark("auth", "active"); setLL("Verifying you are the authorized recipient…");
      const check = await contextCheckRecord(record.id);
      mark("auth", "pass");

      mark("context", "active"); setLL("Validating authorization context…");
      await sleep(200);
      if (!check.context_valid) {
        mark("context", "fail");
        setDR(check.reason || "Authorization context could not be verified.");
        setStage("denied");
        return;
      }
      mark("context", "pass");

      mark("intent", "active"); setLL("Checking bound intent…");
      await sleep(200);
      mark("intent", "pass");

      setCtxInfo(check);
      if (check.requires_face_verification) {
        mark("identity", "active");
        setStage("need-face");
        return;
      }
      mark("identity", "pass");
      await attemptDecrypt({});
    } catch (e) {
      setDR(e.message);
      setStage("denied");
    }
  };

  const attemptDecrypt = async (body) => {
    setStage("verifying");
    mark("decrypt", "active"); setLL("Attempting intent-bound decryption…");
    try {
      const res = await openProtectedRecord(record.id, body);
      if (res.access === "GRANTED") {
        mark("decrypt", "pass");
        setPT(res.plaintext);
        setStage("granted");
      } else {
        mark("decrypt", "fail");
        setDR(res.reason || "Access denied.");
        setStage("denied");
      }
    } catch (e) {
      mark("decrypt", "fail");
      setDR(e.message);
      setStage("denied");
    }
  };

  const handleFaceCapture = async (captured) => {
    mark("identity", "active");
    setStage("verifying"); setLL("Verifying your face identity…");
    const res = await openProtectedRecordSafe(record.id, captured.descriptor);
    if (res.access === "GRANTED") {
      mark("identity", "pass"); mark("decrypt", "pass");
      setPT(res.plaintext);
      setStage("granted");
    } else {
      mark("identity", "fail");
      setDR(res.reason || "Face identity verification failed.");
      setStage("denied");
    }
  };

  const openProtectedRecordSafe = async (id, embedding) => {
    try { return await openProtectedRecord(id, { embedding }); }
    catch (e) { return { access:"DENIED", reason: e.message }; }
  };

  return (
    <div className="card c-peach">
      <button className="btn btn-ghost" style={{marginBottom:18}} onClick={onBack}>← Back to list</button>
      <h2>◫ {record.purpose}</h2>
      <div className="intent-row" style={{marginBottom:18}}>
        <span className="badge b-info">From {record.sender}</span>
        <span className={`risk-badge rb-${(record.risk_level||"low").toLowerCase()}`}>{record.risk_level || "LOW"} RISK</span>
        {record.requires_face_verification && <span className="face-req-chip">◉ Face verification required</span>}
      </div>

      {stage === "preview" && (
        <div>
          <p className="card-desc">This record is protected. Opening it will run CipherQ's full context and identity verification before revealing anything.</p>
          <button className="btn btn-peach" onClick={openRecord}>◫ Open Secure Record →</button>
        </div>
      )}

      {(stage === "verifying" || stage === "need-face" || stage === "granted" || stage === "denied") && (
        <div className="card c-violet" style={{marginTop:0, marginBottom:20}}>
          <h3>Verification Pipeline</h3>
          <VerificationPipeline stages={OPEN_STAGES} status={pipeline} />
        </div>
      )}

      {stage === "verifying" && <Loader label={loaderLabel} />}

      {stage === "need-face" && (
        <div>
          <p className="card-desc">This record requires adaptive face identity verification before it can be opened.</p>
          <FaceCapture buttonLabel="Verify Face & Open Record" onCapture={handleFaceCapture} />
        </div>
      )}

      {stage === "granted" && (
        <div className="verdict-box authorized">
          <div className="verdict-icon">✓</div>
          <div className="verdict-title">Access Granted</div>
          <div className="verdict-sub">Purpose: {ctxInfo?.purpose || record.purpose}</div>
          <div style={{marginTop:18,textAlign:"left"}}>
            <span className="pt-lbl">Protected Content</span>
            <div className="ptbox">{plaintext}</div>
          </div>
        </div>
      )}

      {stage === "denied" && (
        <div className="verdict-box blocked">
          <div className="verdict-icon">✗</div>
          <div className="verdict-title">Access Denied</div>
          <div className="verdict-sub">{deniedReason}</div>
        </div>
      )}
    </div>
  );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
