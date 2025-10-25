import { RecognizedFace } from '../types';

// This file uses face-api.js, which is loaded via a script tag in index.html.
// The `faceapi` object is available globally.
declare const faceapi: any;

export interface FaceDescriptor {
  name: string;
  descriptors: number[][]; // Serializable format
}

class FaceRecognitionService {
  private modelsLoaded = false;
  private readonly MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
  private readonly DISTANCE_THRESHOLD = 0.6;
  private readonly STORAGE_KEY = 'face_recognition_data';

  async loadModels(): Promise<void> {
    if (this.modelsLoaded) return;
    if (typeof faceapi === 'undefined') {
        console.error("face-api.js not loaded");
        return;
    }
    try {
      console.log('Loading face recognition models...');
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(this.MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL),
      ]);
      this.modelsLoaded = true;
      console.log('✅ Face recognition models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading face recognition models:', error);
      throw new Error('Failed to load face recognition models. Please check your internet connection.');
    }
  }

  async extractFaceDescriptor(imageElement: HTMLImageElement): Promise<Float32Array | null> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }
    try {
      const detection = await faceapi
        .detectSingleFace(imageElement)
        .withFaceLandmarks()
        .withFaceDescriptor();
      return detection ? detection.descriptor : null;
    } catch (error) {
      console.error('Error extracting face descriptor:', error);
      return null;
    }
  }

  async recognizeFaces(
    imageElement: HTMLImageElement,
    knownFaces: FaceDescriptor[]
  ): Promise<RecognizedFace[]> {
    if (!this.modelsLoaded) {
      await this.loadModels();
    }
    if (knownFaces.length === 0) {
      return [];
    }
    try {
      const detections = await faceapi
        .detectAllFaces(imageElement)
        .withFaceLandmarks()
        .withFaceDescriptors();
      if (!detections.length) {
        return [];
      }
      
      const labeledDescriptors = knownFaces.map(
        face =>
          new faceapi.LabeledFaceDescriptors(
            face.name,
            face.descriptors.map(d => new Float32Array(d))
          )
      );
      
      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, this.DISTANCE_THRESHOLD);
      
      const results = detections.map((detection: any) => {
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
        const box = detection.detection.box;
        return {
          name: bestMatch.label === 'unknown' ? 'Unknown' : bestMatch.label,
          confidence: Math.round((1 - bestMatch.distance) * 100) / 100,
          box: {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          },
        };
      });
      console.log(`✅ Recognized ${results.length} face(s)`);
      return results;
    } catch (error) {
      console.error('Error recognizing faces:', error);
      return [];
    }
  }

  createImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  saveKnownFaces(faces: FaceDescriptor[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(faces));
    } catch (error) {
      console.error('Error saving known faces:', error);
      throw new Error('Failed to save face data');
    }
  }

  loadKnownFaces(): FaceDescriptor[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as FaceDescriptor[];
    } catch (error) {
      console.error('Error loading known faces:', error);
      return [];
    }
  }

  async addPersonFromFile(file: File, name: string): Promise<boolean> {
    try {
      const imageUrl = URL.createObjectURL(file);
      const img = await this.createImageElement(imageUrl);
      const descriptor = await this.extractFaceDescriptor(img);
      URL.revokeObjectURL(imageUrl);
      
      if (!descriptor) {
        throw new Error('No face detected, or face is not clear enough. Please try another photo.');
      }
      
      const knownFaces = this.loadKnownFaces();
      const existingPersonIndex = knownFaces.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
      
      if (existingPersonIndex >= 0) {
        knownFaces[existingPersonIndex].descriptors.push(Array.from(descriptor));
      } else {
        knownFaces.push({
          name,
          descriptors: [Array.from(descriptor)]
        });
      }
      this.saveKnownFaces(knownFaces);
      return true;
    } catch (error) {
      console.error('Error adding person:', error);
      throw error;
    }
  }

  deletePerson(name: string): void {
    const knownFaces = this.loadKnownFaces();
    const filtered = knownFaces.filter(f => f.name !== name);
    this.saveKnownFaces(filtered);
  }
}

export const faceRecognitionService = new FaceRecognitionService();
