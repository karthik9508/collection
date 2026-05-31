import { SafeStorage } from './storage';

// Storage keys
const STORAGE_KEYS = {
  PROJECT_ID: 'FIREBASE_PROJECT_ID',
};

// --- FIRESTORE REST DATA MAPPING HELPERS ---

function toFirestoreValue(val: any): any {
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') return { doubleValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (val && typeof val === 'object') {
    const fields: any = {};
    Object.entries(val).forEach(([k, v]) => {
      fields[k] = toFirestoreValue(v);
    });
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function fromFirestoreValue(fVal: any): any {
  if (!fVal) return null;
  if ('stringValue' in fVal) return fVal.stringValue;
  if ('doubleValue' in fVal) return Number(fVal.doubleValue);
  if ('integerValue' in fVal) return Number(fVal.integerValue);
  if ('booleanValue' in fVal) return fVal.booleanValue;
  if ('nullValue' in fVal) return null;
  if ('arrayValue' in fVal) {
    const vals = fVal.arrayValue.values || [];
    return vals.map(fromFirestoreValue);
  }
  if ('mapValue' in fVal) {
    const fields = fVal.mapValue.fields || {};
    const res: any = {};
    Object.entries(fields).forEach(([k, v]) => {
      res[k] = fromFirestoreValue(v);
    });
    return res;
  }
  return fVal;
}

export function toFirestoreDocument(obj: Record<string, any>) {
  const fields: Record<string, any> = {};
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      fields[key] = toFirestoreValue(val);
    }
  });
  return { fields };
}

export function fromFirestoreDocument(doc: any): any {
  if (!doc || !doc.fields) return null;
  const res: Record<string, any> = {};
  
  // Extract ID from full name path: "projects/{project}/databases/(default)/documents/{collection}/{docId}"
  const parts = doc.name ? doc.name.split('/') : [];
  res.id = parts.length > 0 ? parts[parts.length - 1] : '';

  Object.entries(doc.fields).forEach(([key, fVal]) => {
    res[key] = fromFirestoreValue(fVal);
  });

  return res;
}

// --- FIRESTORE CLIENT ---

export class FirestoreClient {
  private projectId: string;
  private baseUrl: string;

  constructor(projectId: string) {
    this.projectId = projectId.trim();
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
  }

  private async request(path: string, method: string, body?: any) {
    const url = `${this.baseUrl}/${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Firestore REST Error (${response.status}): ${errText}`);
    }

    if (method === 'DELETE') {
      return true;
    }

    return await response.json();
  }

  /**
   * Fetches all documents from a collection and applies local filters/sorting
   * to bypass complex Firestore index requirements.
   */
  async select(
    collection: string,
    filters: Record<string, any> = {},
    orderBy?: string
  ): Promise<any[]> {
    try {
      const data = await this.request(collection, 'GET');
      const docs = data.documents || [];
      let parsed = docs.map(fromFirestoreDocument).filter(Boolean);

      // 1. Apply Filters
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          parsed = parsed.filter((doc) => doc[key] === val);
        }
      });

      // 2. Apply Ordering
      if (orderBy) {
        // e.g. "bill_date.desc" or "name.asc"
        const [field, direction] = orderBy.split('.');
        const isDesc = direction === 'desc';

        parsed.sort((a, b) => {
          const valA = a[field];
          const valB = b[field];

          if (valA === undefined) return 1;
          if (valB === undefined) return -1;

          if (typeof valA === 'string' && typeof valB === 'string') {
            return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
          }

          return isDesc ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
        });
      }

      return parsed;
    } catch (err) {
      // 404 means the collection doesn't exist yet, return empty list gracefully
      if (String(err).includes('404')) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Inserts/Upserts a document in a collection with a specific ID.
   */
  async insert(collection: string, docId: string, data: any) {
    const payload = toFirestoreDocument({ ...data, id: docId });
    // PATCH creates a document if it doesn't exist, acting as an upsert/set!
    const res = await this.request(`${collection}/${docId}`, 'PATCH', payload);
    return fromFirestoreDocument(res);
  }

  /**
   * Updates fields inside a document.
   */
  async update(collection: string, docId: string, data: any) {
    const payload = toFirestoreDocument(data);
    const res = await this.request(`${collection}/${docId}`, 'PATCH', payload);
    return fromFirestoreDocument(res);
  }

  /**
   * Deletes a document.
   */
  async delete(collection: string, docId: string) {
    return await this.request(`${collection}/${docId}`, 'DELETE');
  }
}

// --- STATE MANAGEMENT ---

let activeClient: FirestoreClient | null = null;

export async function initializeFirebase(
  projectId?: string,
  persist = true
): Promise<FirestoreClient | null> {
  try {
    let finalId = projectId;

    if (!finalId) {
      finalId = (await SafeStorage.getItem(STORAGE_KEYS.PROJECT_ID)) || undefined;
    }

    if (!finalId) {
      finalId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    }

    if (!finalId || !finalId.trim()) {
      console.log('[Firebase] No Project ID found. Running in Local Offline Mode.');
      activeClient = null;
      return null;
    }

    finalId = finalId.trim();
    activeClient = new FirestoreClient(finalId);

    // Test connection with a fast mock check
    try {
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/${finalId}/databases/(default)/documents/customers?pageSize=1`);
      if (!response.ok && response.status !== 404) {
        throw new Error(`Status ${response.status}`);
      }
      console.log('[Firebase] Connection test successful!');
    } catch (testErr) {
      console.warn('[Firebase] Connection test warning:', testErr);
    }

    if (persist && projectId) {
      await SafeStorage.setItem(STORAGE_KEYS.PROJECT_ID, finalId);
    }

    console.log(`[Firebase] Client initialized for project: ${finalId}`);
    return activeClient;
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    activeClient = null;
    return null;
  }
}

export function getFirebase(): FirestoreClient | null {
  return activeClient;
}

export function isFirebaseConfigured(): boolean {
  return activeClient !== null;
}

export async function getFirebaseCredentials() {
  const projectId = (await SafeStorage.getItem(STORAGE_KEYS.PROJECT_ID)) || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || null;
  return { projectId };
}

export async function clearFirebaseCredentials(): Promise<void> {
  await SafeStorage.removeItem(STORAGE_KEYS.PROJECT_ID);
  activeClient = null;
  console.log('[Firebase] Project ID cleared. Reverted to Local Offline Mode.');
}
