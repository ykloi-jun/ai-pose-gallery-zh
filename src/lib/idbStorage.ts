const DB_NAME = 'pose_atlas_studio_db'
const STORE_NAME = 'kv_store'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbRead<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
export async function idbGet<T>(key: string): Promise<T | undefined> {
  try { return await idbRead<T>(key) } catch { return undefined }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore storage errors in private browsing
  }
}

// 确认保存成功的操作必须等待事务提交。
export async function idbWrite<T>(key: string, value: T): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('浏览器存储写入失败'))
    })
  } finally { db.close() }
}

// Keep the read and write in one transaction to preserve changes from other tabs.
export async function idbUpdate<T>(key: string, update: (current: T | undefined) => T): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)
      let next: T
      tx.oncomplete = () => resolve(next)
      tx.onabort = () => reject(tx.error || new Error('浏览器存储写入失败'))
      request.onsuccess = () => {
        try {
          next = update(request.result)
          if (next !== request.result) store.put(next, key)
        } catch (error) {
          tx.abort()
          reject(error)
        }
      }
    })
  } finally { db.close() }
}
