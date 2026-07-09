import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
let loadPromise: Promise<void> | null = null;

export function loadFaceModels() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => undefined);
  }
  return loadPromise;
}

const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

export async function detectFaceBox(video: HTMLVideoElement) {
  const detection = await faceapi.detectSingleFace(video, detectorOptions);
  if (!detection) return null;
  return detection.box;
}

export async function computeFaceDescriptor(video: HTMLVideoElement) {
  const detection = await faceapi
    .detectSingleFace(video, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor);
}
