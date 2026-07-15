export default function Loader({ label = "Processing…" }) {
  return (
    <div className="loader">
      <div className="loader-ring"></div>
      <p className="loader-lbl">{label}</p>
    </div>
  );
}
