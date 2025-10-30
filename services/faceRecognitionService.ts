// src/services/faceRecognitionService.ts
import { RecognizedFace } from '../types';

declare global {
  interface Window {
    faceapi?: any;
  }
}

export interface FaceDescriptor {
  name: string;
  descriptors: number[][];
  thumbnail?: string;
}

class FaceRecognitionService {
  private modelsLoaded = false;
  private isAvailable = false;

  // Prefer local models; fall back to CDN if missing/404
  private readonly LOCAL_MODEL_URL = '/models/';
  private readonly CDN_MODEL_URL =
    'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
  private modelSource: 'local' | 'cdn' | 'none' = 'none';

  private readonly DISTANCE_THRESHOLD = 0.55;
  private readonly STORAGE_KEY = 'face_recognition_data_v1';
  private readonly SCRIPT_CDN =
    'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js';

  private loadScriptPromise: Promise<void> | null = null;

  // ---------- FaceAPI script loader ----------
  private ensureFaceApi = async (): Promise<boolean> => {
    if (typeof window !== 'undefined' && window.faceapi) return true;

    if (!this.loadScriptPromise) {
      this.loadScriptPromise = new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = this.SCRIPT_CDN;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load face-api script'));
        document.head.appendChild(s);
      });
    }

    try {
      await this.loadScriptPromise;
      return typeof window.faceapi !== 'undefined';
    } catch (e) {
      console.warn('face-api script failed to load:', e);
      return false;
    }
  };

  // ---------- Model loader with fallback ----------
  private tryLoadModelsFrom = async (baseUrl: string): Promise<boolean> => {
    const faceapi = window.faceapi;
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(baseUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
    ]);
    return true;
  };

  private ensureModels = async (): Promise<boolean> => {
    const hasApi = await this.ensureFaceApi();
    if (!hasApi) {
      console.warn('face-api.js not loaded - face recognition disabled');
      this.isAvailable = false;
      this.modelSource = 'none';
      return false;
    }

    if (this.modelsLoaded) {
      this.isAvailable = true;
      return true;
    }

    try {
      await this.tryLoadModelsFrom(this.LOCAL_MODEL_URL);
      this.modelSource = 'local';
      this.modelsLoaded = true;
      this.isAvailable = true;
      console.log('✅ Face models loaded from /models/');
      return true;
    } catch (localErr) {
      console.warn('Local model load failed, trying CDN…', localErr);
      try {
        await this.tryLoadModelsFrom(this.CDN_MODEL_URL);
        this.modelSource = 'cdn';
        this.modelsLoaded = true;
        this.isAvailable = true;
        console.log('✅ Face models loaded from CDN');
        return true;
      } catch (cdnErr) {
        console.warn('❌ Could not load models from local or CDN', cdnErr);
        this.isAvailable = false;
        this.modelSource = 'none';
        return false;
      }
    }
  };

  // ---------- Public API ----------
  loadModels = async (): Promise<void> => {
    await this.ensureModels();
  };

  extractFaceDescriptor = async (
    img: HTMLImageElement
  ): Promise<Float32Array | null> => {
    const ready = await this.ensureModels();
    if (!ready) return null;
    const faceapi = window.faceapi;
    try {
      const d = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();
      return d ? d.descriptor : null;
    } catch (e) {
      console.error('Error extracting descriptor:', e);
      return null;
    }
  };

  // AU spelling (primary)
  recogniseFaces = async (
    img: HTMLImageElement,
    known: FaceDescriptor[]
  ): Promise<RecognizedFace[]> => {
    const ready = await this.ensureModels();
    if (!ready || known.length === 0) return [];
    const faceapi = window.faceapi;

    const dets = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!dets.length) return [];

    const labelled = known.map(
      (f) =>
        new faceapi.LabeledFaceDescriptors(
          f.name,
          f.descriptors.map((d) => new Float32Array(d))
        )
    );

    const matcher = new faceapi.FaceMatcher(labelled, this.DISTANCE_THRESHOLD);

    return dets.map((det: any) => {
      const best = matcher.findBestMatch(det.descriptor);
      const box = det.detection.box;
      return {
        name: best.label === 'unknown' ? 'Unknown' : best.label,
        confidence: Math.round((1 - best.distance) * 100) / 100,
        box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
      };
    });
  };

  // US spelling (compat alias)
  recognizeFaces = async (
    img: HTMLImageElement,
    known: FaceDescriptor[]
  ): Promise<RecognizedFace[]> => {
    return this.recogniseFaces(img, known);
  };

  createImageElement = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      (img as any).referrerPolicy = 'no-referrer';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  };

  saveKnownFaces = (faces: FaceDescriptor[]): void => {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(faces));
  };

  loadKnownFaces = (): FaceDescriptor[] => {
    const v = localStorage.getItem(this.STORAGE_KEY);
    return v ? (JSON.parse(v) as FaceDescriptor[]) : [];
  };

  addPersonFromFile = async (file: File, name: string): Promise<boolean> => {
    const ready = await this.ensureModels();
    if (!ready) throw new Error('Face recognition is not available');

    const url = URL.createObjectURL(file);
    try {
      const img = await this.createImageElement(url);
      
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 64;
      let { width, height } = img;
      if (width > height) {
          if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
          }
      } else {
          if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
          }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(img, 0, 0, width, height);
      const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);

      const desc = await this.extractFaceDescriptor(img);
      if (!desc) throw new Error('No face detected or not clear enough.');

      const known = this.loadKnownFaces();
      const i = known.findIndex(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );
      if (i >= 0) {
        known[i].descriptors.push(Array.from(desc));
        if (!known[i].thumbnail) {
            known[i].thumbnail = thumbnailDataUrl;
        }
      } else {
        known.push({ name, descriptors: [Array.from(desc)], thumbnail: thumbnailDataUrl });
      }
      this.saveKnownFaces(known);
      return true;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  deletePerson = (name: string): void => {
    this.saveKnownFaces(this.loadKnownFaces().filter((f) => f.name !== name));
  };

  isFaceRecognitionAvailable = (): boolean => this.isAvailable;

  getStatus = () => ({
    modelsLoaded: this.modelsLoaded,
    isAvailable: this.isAvailable,
    modelSource: this.modelSource,
  });
}

export const faceRecognitionService = new FaceRecognitionService();

// ---- Face rec hard alias + helper exports (compat for any call site) ----
(faceRecognitionService as any).recognizeFaces =
  faceRecognitionService.recogniseFaces.bind(faceRecognitionService);

export const recogniseFaces = (
  ...args: Parameters<typeof faceRecognitionService.recogniseFaces>
) => (faceRecognitionService as any).recogniseFaces(...args);

export const recognizeFaces = (
  ...args: Parameters<typeof faceRecognitionService.recogniseFaces>
) => (faceRecognitionService as any).recogniseFaces(...args);

// Default export so imports like `import pn from '.../faceRecognitionService'` work
export default faceRecognitionService;