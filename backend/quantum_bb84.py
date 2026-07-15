"""
quantum_bb84.py — Real BB84 quantum key distribution using Qiskit.
--------------------------------------------------------------------
Unlike a vectorized/classical simulation, this builds and runs an
ACTUAL 1-qubit quantum circuit per bit, on Qiskit Aer's statevector
simulator. Each qubit goes through Alice's encoding gates, an optional
eavesdropper (Eve) intercept-resend, and Bob's measurement gates —
exactly as the real BB84 protocol specifies.

Requires: qiskit, qiskit-aer  (see requirements.txt)
    pip install qiskit qiskit-aer

BB84 basis convention used here:
    basis 0 = rectilinear / computational (Z) basis  -> {|0>, |1>}
    basis 1 = diagonal (X) basis                      -> {|+>, |->}

Per-qubit protocol:
    1. Alice picks a random bit and a random basis.
       - bit=1 -> apply X gate (|0> -> |1>)
       - basis=1 (X) -> apply H gate to rotate into the diagonal basis
    2. (Optional) Eve intercepts: measures in her own random basis,
       collapsing the qubit, then re-prepares and forwards a fresh
       qubit encoding what she measured. This is the real physical
       mechanism (wavefunction collapse / no-cloning) that introduces
       detectable errors when Eve's basis disagrees with Alice's —
       not injected classical noise.
    3. Bob picks a random basis. If it's the X basis, he applies H
       before measuring in the computational basis (undoing step 1's
       rotation only when his basis matches).
    4. Bob's measured bit is read out of the circuit.

After all qubits: Alice and Bob publicly compare bases (sifting),
keep only bits where bases matched, then sacrifice a public sample of
the sifted key to estimate the Quantum Bit Error Rate (QBER). QBER
above the abort threshold indicates eavesdropping and the key is
discarded — this is what actually gives BB84 its security guarantee.
"""
import hashlib
import secrets

import numpy as np

try:
    from qiskit import QuantumCircuit
    from qiskit_aer import AerSimulator
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

BASIS_Z = 0  # rectilinear / computational
BASIS_X = 1  # diagonal / Hadamard

QBER_ABORT_THRESHOLD = 0.11  # 11%, matches the frontend's stated protocol spec

_simulator = AerSimulator() if QISKIT_AVAILABLE else None


def _require_qiskit():
    if not QISKIT_AVAILABLE:
        raise RuntimeError(
            "qiskit / qiskit-aer are not installed. Run: "
            "pip install qiskit qiskit-aer   (see backend/requirements.txt)"
        )


def build_bb84_circuit(alice_bit: int, alice_basis: int, bob_basis: int) -> "QuantumCircuit":
    """Build the actual 1-qubit circuit for one BB84 round. Exposed
    separately so it can be drawn/inspected for verification."""
    _require_qiskit()
    qc = QuantumCircuit(1, 1, name="bb84_round")

    if alice_bit == 1:
        qc.x(0)
    if alice_basis == BASIS_X:
        qc.h(0)

    qc.barrier()

    if bob_basis == BASIS_X:
        qc.h(0)
    qc.measure(0, 0)
    return qc


def run_single_qubit(alice_bit: int, alice_basis: int, bob_basis: int) -> int:
    """Actually execute the 1-qubit circuit on Qiskit Aer and return
    the measured classical bit."""
    _require_qiskit()
    qc = build_bb84_circuit(alice_bit, alice_basis, bob_basis)
    result = _simulator.run(qc, shots=1, memory=True).result()
    return int(result.get_memory(qc)[0])


def simulate_bb84_qiskit(n_qubits: int = 256, eavesdrop_prob: float = 0.0) -> dict:
    """Run a full BB84 key exchange, one real qubit circuit at a time.

    eavesdrop_prob: probability [0,1] that Eve intercepts any given
    qubit (intercept-resend attack). 0.0 = no eavesdropper.
    """
    _require_qiskit()
    rng = np.random.default_rng()

    alice_bits = rng.integers(0, 2, n_qubits)
    alice_bases = rng.integers(0, 2, n_qubits)
    bob_bases = rng.integers(0, 2, n_qubits)
    eve_intercepts = rng.random(n_qubits) < eavesdrop_prob if eavesdrop_prob > 0 else np.zeros(n_qubits, dtype=bool)

    bob_bits = np.zeros(n_qubits, dtype=int)
    circuits_run = 0

    for i in range(n_qubits):
        a_bit, a_basis, b_basis = int(alice_bits[i]), int(alice_bases[i]), int(bob_bases[i])

        if eve_intercepts[i]:
            # Eve measures in her own random basis (collapses the qubit),
            # then re-prepares and forwards what she saw. If her basis
            # disagrees with Alice's, this physically randomizes the bit
            # Bob will see whenever his basis matches Alice's — a real
            # consequence of quantum measurement, not injected noise.
            eve_basis = int(rng.integers(0, 2))
            eve_bit = run_single_qubit(a_bit, a_basis, eve_basis)
            circuits_run += 1
            bob_bit = run_single_qubit(eve_bit, eve_basis, b_basis)
            circuits_run += 1
        else:
            bob_bit = run_single_qubit(a_bit, a_basis, b_basis)
            circuits_run += 1

        bob_bits[i] = bob_bit

    # ── Sifting: keep only rounds where Alice's and Bob's bases matched ──
    matching = alice_bases == bob_bases
    sifted_alice = alice_bits[matching]
    sifted_bob = bob_bits[matching]

    if len(sifted_alice) == 0:
        return {
            "quantum_key_hex": "", "qber": 1.0, "sifted_bits": 0,
            "session_aborted": True, "circuits_run": circuits_run, "backend": "qiskit-aer",
        }

    # ── Public QBER estimate: sacrifice ~20% of the sifted key ──
    n_check = max(1, len(sifted_alice) // 5)
    check_idx = rng.choice(len(sifted_alice), size=n_check, replace=False)
    errors = int(np.sum(sifted_alice[check_idx] != sifted_bob[check_idx]))
    qber = errors / n_check

    remaining_mask = np.ones(len(sifted_alice), dtype=bool)
    remaining_mask[check_idx] = False
    final_key_bits = sifted_alice[remaining_mask]

    aborted = qber > QBER_ABORT_THRESHOLD
    key_bytes = np.packbits(final_key_bits).tobytes() if len(final_key_bits) else b""
    # Stretch the raw sifted bits into a 256-bit key suitable for AES-256
    key_hex = hashlib.sha256(key_bytes + secrets.token_bytes(8)).hexdigest()

    return {
        "quantum_key_hex": key_hex,
        "qber": round(qber, 4),
        "sifted_bits": int(len(final_key_bits)),
        "session_aborted": bool(aborted),
        "circuits_run": circuits_run,
        "backend": "qiskit-aer",
    }


def quantum_backend_info() -> dict:
    """Diagnostic info to prove a real Qiskit backend is wired up —
    used by GET /api/quantum-info."""
    if not QISKIT_AVAILABLE:
        return {"qiskit_available": False}
    import qiskit
    sample = build_bb84_circuit(alice_bit=1, alice_basis=BASIS_X, bob_basis=BASIS_X)
    return {
        "qiskit_available": True,
        "qiskit_version": qiskit.__version__,
        "simulator": _simulator.name if hasattr(_simulator, "name") else str(_simulator),
        "sample_circuit_diagram": str(sample.draw(output="text")),
    }
