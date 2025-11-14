// services/dbService.ts
let dbPromise: Promise<IDBDatabase> | null = null;

const DB_NAME = 'GranulaDB';
const STORE_NAME = 'mediaFiles';
const DB_VERSION = 1;

const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const dbInstance = (event.target as IDBOpenDBRequest).result;
        if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
          dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
};

export const initDB = async (): Promise<boolean> => {
  try {
    await getDB();
    return true;
  } catch (error) {
    console.error("Failed to initialize DB:", error);
    return false;
  }
};

export const saveMedia = async (id: string, data: { url: string, mimeType: string, name?: string }): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
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

export const getMedia = async (id: string): Promise<{ url: string, mimeType: string, name?: string } | null> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
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

export const deleteMedia = async (id: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
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