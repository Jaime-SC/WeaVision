// Tiny IndexedDB key-value store: playlists' channel arrays are big, everything else is small.
const DB_NAME = "weavision";
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction("kv", mode).objectStore("kv"));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const kv = {
  get: <T>(key: string) => tx<T | undefined>("readonly", (s) => s.get(key)),
  set: (key: string, value: unknown) => tx<void>("readwrite", (s) => s.put(value, key)),
  del: (key: string) => tx<void>("readwrite", (s) => s.delete(key)),
};
