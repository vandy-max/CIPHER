import { useEffect, useState } from "react";
import { getFaceStatus, faceEnroll } from "../services/api";
import FaceCapture from "../components/FaceCapture";

export default function AccountSecurityPage({ user }) {
  const [status, setStatus]   = useState(null);
  const [reEnrolling, setRE]  = useState(false);
  const [notice, setNotice]   = useState("");

  const load = () => getFaceStatus().then(setStatus).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleEnroll = async (captured) => {
    try {
      await faceEnroll(captured.descriptor);
      setNotice("Face identity enrolled successfully.");
      setRE(false);
      load();
    } catch (e) { setNotice(`Enrollment failed: ${e.message}`); }
  };

  return (
    <div className="page">
      <div className="ph">
        <h1>Account &amp; <span className="grad">Security</span></h1>
        <p style={{color:"var(--text2)",marginTop:6,fontSize:15}}>Your profile and the face identity template used for adaptive verification</p>
      </div>

      <div className="card c-indigo">
        <div className="profile-avatar">{user?.username?.[0]?.toUpperCase()}</div>
        <h2 style={{marginBottom:16}}>Profile</h2>
        <div className="kv-row"><span className="kv-label">Username</span><span className="kv-value">{user?.username}</span></div>
        <div className="kv-row"><span className="kv-label">Email</span><span className="kv-value">{user?.email || "—"}</span></div>
        <div className="kv-row"><span className="kv-label">Role</span><span className="badge b-info">{user?.role?.replace(/_/g," ")}</span></div>
        <div className="kv-row"><span className="kv-label">Department</span><span className="kv-value">{user?.department || "—"}</span></div>
        <div className="kv-row"><span className="kv-label">Privilege Level</span><span className="badge b-info">L{user?.privilege_level ?? "—"}</span></div>
        <div className="kv-row"><span className="kv-label">Account Status</span><span className="badge b-success">Active</span></div>
      </div>

      <div className="card c-sky">
        <h2>◉ Face Identity</h2>
        <p className="card-desc">
          Required to use Access Request, Secure Send and Received Records — CipherQ verifies your face
          identity on every privileged access decision and every Protected Record you send or open, so a
          stolen password alone can never access protected banking data. This is identity matching, not
          expression/emotion analysis.
        </p>
        {status && (
          <div className="kv-row">
            <span className="kv-label">Enrollment Status</span>
            {status.enrolled
              ? <span className="badge b-success">✓ Enrolled{status.enrolled_at ? ` — ${new Date(status.enrolled_at).toLocaleDateString()}` : ""}</span>
              : <span className="badge b-warning">Not enrolled</span>}
          </div>
        )}
        {notice && <div className={notice.startsWith("Enrollment failed") ? "err" : "suc"} style={{marginTop:14}}>{notice}</div>}

        {!reEnrolling ? (
          <button className="btn btn-violet" style={{marginTop:16}} onClick={() => setRE(true)}>
            {status?.enrolled ? "Re-enroll Face →" : "Enroll Face Identity →"}
          </button>
        ) : (
          <div style={{marginTop:18}}>
            <FaceCapture
              buttonLabel={status?.enrolled ? "Re-enroll Face" : "Enroll Face"}
              subtitle="Look directly at the camera in good lighting. Only a 128-value face descriptor is stored — never the image."
              onCapture={handleEnroll}
            />
            <button className="btn btn-ghost btn-full" style={{marginTop:10}} onClick={() => setRE(false)}>Cancel</button>
          </div>
        )}
      </div>

      <div className="card c-mint">
        <h2>Security Model</h2>
        <div className="kv-row"><span className="kv-label">Password Authentication</span><span className="kv-value">PBKDF2-HMAC-SHA256</span></div>
        <div className="kv-row"><span className="kv-label">Transaction Protection</span><span className="kv-value">AES-256-GCM</span></div>
        <div className="kv-row"><span className="kv-label">Quantum Key Security</span><span className="kv-value">BB84 on Qiskit Aer</span></div>
        <div className="kv-row"><span className="kv-label">Face Identity Model</span><span className="kv-value">face-api.js (pretrained)</span></div>
      </div>
    </div>
  );
}
