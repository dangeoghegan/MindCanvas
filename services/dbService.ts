// services/dbService.ts
let db: IDBDatabase;

const DB_NAME = 'MindCanvasDB';
const STORE_NAME = 'mediaFiles';
const DB_VERSION = 1;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(true);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(false);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveMedia = (id: string, data: { url: string, mimeType: string, name?: string }): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, ...data });
    
    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Error saving media:', request.error);
        reject(request.error);
    };
  });
};

export const getMedia = (id: string): Promise<{ url: string, mimeType: string, name?: string } | null> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
        resolve(request.result || null);
    };
    request.onerror = () => {
        console.error('Error getting media:', request.error);
        reject(request.error);
    };
  });
};

export const deleteMedia = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject('DB not initialized');
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Error deleting media:', request.error);
        reject(request.error);
    };
  });
};
