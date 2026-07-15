/**
 * services/faceApi.js
 * -------------------
 * Browser-side face detection + expression recognition using face-api.js
 * Model files are served from /public/models/ (bundled with the app).
 *
 * Allowed: neutral, happy
 * Blocked: angry, fearful, disgusted, sad, surprised
 */

import * as faceapi from '@vladmandic/face-api';

const MODEL_URL = '/models';
let modelsLoaded = false;
let loadingPromise = null;

export async function loadModels() {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    // Pretrained nets used ONLY for face IDENTITY verification (enrollment
    // + adaptive step-up check), never for expression analysis. Both are
    // already bundled in /public/models/ — no new model files were added.
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log('[face-api] Models loaded');
  })();
  return loadingPromise;
}

/**
 * Returns a 128-length Float32Array face identity descriptor from a video
 * or image element, or null if no face was found. This is the ONLY thing
 * ever sent to the backend for enrollment/verification — never a raw
 * image or video frame.
 */
export async function getFaceDescriptor(element) {
  await loadModels();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  try {
    const result = await faceapi
      .detectSingleFace(element, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    if (!result) return null;
    return Array.from(result.descriptor);
  } catch (err) {
    console.error('[face-api] descriptor error', err);
    return null;
  }
}

export async function detectExpressionFromElement(element) {
  await loadModels();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
  let detection;
  try {
    detection = await faceapi.detectSingleFace(element, options).withFaceExpressions();
  } catch (err) {
    return errorResult(`Detection error: ${err.message}`);
  }

  if (!detection) {
    return { emotion:'unknown', confidence:0, all_scores:{}, access_granted:false,
      reason:'No face detected. Face the camera directly in good lighting.', faceDetected:false };
  }

  const e = detection.expressions;
  const scores = {
    neutral:   round(e.neutral),
    happy:     round(e.happy),
    sad:       round(e.sad),
    angry:     round(e.angry),
    fearful:   round(e.fearful),
    disgusted: round(e.disgusted),
    surprised: round(e.surprised),
  };

  const [emotion, confidence] = Object.entries(scores).sort(([,a],[,b])=>b-a)[0];
  const ALLOWED = new Set(['neutral','happy']);
  const access_granted = ALLOWED.has(emotion) && confidence >= 0.30;
  const reason = access_granted
    ? `"${emotion}" expression detected — access granted.`
    : ALLOWED.has(emotion)
    ? `"${emotion}" detected but confidence ${(confidence*100).toFixed(0)}% is too low. Improve lighting.`
    : `"${emotion}" expression is not permitted. Only neutral or happy allowed.`;

  return { emotion, confidence, all_scores:scores, access_granted, reason, faceDetected:true };
}

export async function detectExpressionFromBase64(base64) {
  await loadModels();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(await detectExpressionFromElement(canvas));
    };
    img.onerror = () => resolve(errorResult('Failed to load image.'));
    img.src = base64;
  });
}

const round = (n) => Math.round(n * 1000) / 1000;
function errorResult(reason) {
  return { emotion:'unknown', confidence:0, all_scores:{}, access_granted:false, reason, faceDetected:false };
}
export { faceapi };
