/**
 * FaceCapture.jsx
 * ----------------
 * One shared camera component used everywhere CipherQ needs a face:
 *   - Face enrollment (registration / Account & Security "Re-enroll")
 *   - Adaptive face identity verification (Secure Send / Received Records)
 *
 * It always extracts a 128-d face-api.js FaceRecognitionNet descriptor
 * (identity, pretrained, never trained here) and, as a side reading, the
 * live expression label (kept ONLY as an "experimental behavioral signal"
 * — never treated as identity or intent proof).
 *
 * Nothing but the descriptor array / emotion label ever leaves the browser.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { loadModels, getFaceDescriptor, faceapi } from "../services/faceApi";

export default function FaceCapture({ onCapture, buttonLabel = "Capture Face", subtitle }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const streamRef = useRef(null);

  const [modelReady, setModelReady] = useState(false);
  const [camActive, setCamActive]   = useState(false);
  const [liveExpr, setLiveExpr]     = useState(null);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState("");
  const [stuck, setStuck]           = useState(false);
  const stuckTimerRef = useRef(null);

  useEffect(() => {
    loadModels().then(() => setModelReady(true)).catch(e => setError(`Model load failed: ${e.message}`));
    startCam();
    return () => stopCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If we've been scanning for a while with no face ever detected, offer a
  // restart — most often fixes a camera stream that got stuck.
  useEffect(() => {
    clearTimeout(stuckTimerRef.current);
    setStuck(false);
    if (camActive && !liveExpr) {
      stuckTimerRef.current = setTimeout(() => setStuck(true), 6000);
    }
    return () => clearTimeout(stuckTimerRef.current);
  }, [camActive, liveExpr]);

  const restartCam = () => { stopCam(); setError(""); setTimeout(startCam, 150); };

  const startCam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480, facingMode:"user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCamActive(true);
        runLoop();
      }
    } catch (e) { setError("Camera access denied — allow camera permissions to continue."); }
  }, []);

  const stopCam = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCamActive(false); setLiveExpr(null);
  }, []);

  const runLoop = useCallback(() => {
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize:320, scoreThreshold:.35 });
    const loop = async () => {
      const video = videoRef.current, canvas = canvasRef.current;
      // Never let the loop die permanently — a momentarily-paused or
      // not-yet-ready video (common right after getUserMedia/play()) used
      // to cause an early `return` here with nothing ever rescheduling the
      // next frame, which silently froze detection forever and made the
      // Capture button stay disabled. Now we just skip this one frame and
      // keep the loop alive.
      if (!video || video.readyState < 2 || video.paused || !canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      try {
        const det = await faceapi.detectSingleFace(video, opts).withFaceExpressions();
        canvas.width  = video.videoWidth  || video.clientWidth;
        canvas.height = video.videoHeight || video.clientHeight;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if (det) {
          const {x,y,width,height} = det.detection.box;
          const sx = canvas.width  / (video.videoWidth  || canvas.width);
          const sy = canvas.height / (video.videoHeight || canvas.height);
          const [emo, conf] = Object.entries(det.expressions).sort(([,a],[,b]) => b-a)[0];
          ctx.strokeStyle = "#0d7a80"; ctx.lineWidth = 2.5;
          ctx.strokeRect(x*sx, y*sy, width*sx, height*sy);
          setLiveExpr({ emotion:emo, confidence:conf });
        } else { setLiveExpr(null); ctx.clearRect(0,0,canvas.width,canvas.height); }
      } catch(err) { console.error("[FaceCapture] detection error", err); }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const handleCapture = async () => {
    setError(""); setBusy(true);
    try {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        throw new Error("Camera isn't ready yet — wait a moment and try again.");
      }
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (!descriptor) throw new Error("No face detected — face the camera directly in good lighting and try again.");
      const result = { descriptor, emotion: liveExpr?.emotion || "unknown", confidence: liveExpr?.confidence || 0 };
      stopCam();
      onCapture(result);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {subtitle && <p className="card-desc">{subtitle}</p>}
      {!modelReady && <div style={{fontSize:13,color:"var(--accent)",marginBottom:12}}>⌛ Loading face verification model…</div>}
      {error && <div className="err">⚠ {error}</div>}
      <div className="cam-wrap">
        <video ref={videoRef} autoPlay muted playsInline style={{width:"100%",transform:"scaleX(-1)",display:camActive?"block":"none"}} />
        <canvas ref={canvasRef} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",transform:"scaleX(-1)",pointerEvents:"none",display:camActive?"block":"none"}} />
        <div className="corner tl"></div><div className="corner tr"></div>
        <div className="corner bl"></div><div className="corner br"></div>
        {camActive && (
          <div className="cam-status-bar">
            <div className="cam-dot"></div>
            <span className="cam-label">{liveExpr ? "Face detected" : "Scanning…"}</span>
          </div>
        )}
        {!camActive && !error && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:200,fontSize:13,color:"var(--text3)"}}>
            Initialising camera…
          </div>
        )}
      </div>
      {stuck && !error && (
        <div className="note" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <span>Still not detecting a face — check lighting and camera permissions.</span>
          <button className="btn btn-ghost" style={{padding:"6px 14px",fontSize:12}} onClick={restartCam}>↻ Restart Camera</button>
        </div>
      )}
      <button className="btn btn-primary btn-full" onClick={handleCapture} disabled={!liveExpr || busy || !modelReady} style={{marginTop: stuck ? 12 : 0}}>
        {busy ? "Processing…" : liveExpr ? `📸 ${buttonLabel}` : "Waiting for face…"}
      </button>
    </div>
  );
}
