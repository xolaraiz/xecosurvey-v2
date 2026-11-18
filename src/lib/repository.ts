import { openDB, IDBPDatabase } from 'idb';
import { SolarSurveyProject, StandardReference } from '../types/survey';
import { DEMO_PROJECTS, INITIAL_STANDARD_REFERENCES } from './demoData';

const DB_NAME = 'xolaraiz-survey-pro-db';
const DB_VERSION = 1;

export interface StorageHealthInfo {
  usedBytes: number;
  quotaBytes: number;
  usedPct: number;
  nearLimit: boolean;
}

export interface ISurveyRepository {
  getProjects(): Promise<SolarSurveyProject[]>;
  saveProject(project: SolarSurveyProject, expectedServerVersion?: string): Promise<{
    saved: SolarSurveyProject;
    conflict?: { local: SolarSurveyProject; remote: SolarSurveyProject };
  }>;
  deleteProject(id: string): Promise<void>;
  getStandards(): Promise<StandardReference[]>;
  saveStandards(standards: StandardReference[]): Promise<void>;
  resetDemoData(): Promise<void>;
  getStorageHealth(): Promise<StorageHealthInfo>;
  exportAllJson(): Promise<string>;
}

class IndexedDBSurveyRepository implements ISurveyRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private async getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('projects')) {
            db.createObjectStore('projects', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('standards')) {
            db.createObjectStore('standards', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta');
          }
        },
      });
    }
    return this.dbPromise;
  }

  private async ensureSeeded(): Promise<void> {
    const db = await this.getDb();
    const seeded = await db.get('meta', 'seeded_v1');
    if (!seeded) {
      const tx = db.transaction(['projects', 'standards', 'meta'], 'readwrite');
      for (const proj of DEMO_PROJECTS) {
        await tx.objectStore('projects').put(proj);
      }
      for (const std of INITIAL_STANDARD_REFERENCES) {
        await tx.objectStore('standards').put(std);
      }
      await tx.objectStore('meta').put(true, 'seeded_v1');
      await tx.done;
    }
  }

  async getProjects(): Promise<SolarSurveyProject[]> {
    await this.ensureSeeded();
    const db = await this.getDb();
    const all = (await db.getAll('projects')) as SolarSurveyProject[];
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveProject(
    project: SolarSurveyProject,
    expectedPreviousUpdatedAt?: string
  ): Promise<{
    saved: SolarSurveyProject;
    conflict?: { local: SolarSurveyProject; remote: SolarSurveyProject };
  }> {
    await this.ensureSeeded();
    const db = await this.getDb();
    const existing = (await db.get('projects', project.id)) as SolarSurveyProject | undefined;

    if (
      existing &&
      expectedPreviousUpdatedAt &&
      existing.updatedAt !== expectedPreviousUpdatedAt &&
      project.syncState !== 'Conflict'
    ) {
      const conflicted: SolarSurveyProject = {
        ...project,
        syncState: 'Conflict',
      };
      return {
        saved: conflicted,
        conflict: { local: conflicted, remote: existing },
      };
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const toSave: SolarSurveyProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      syncState: isOffline ? 'Pending sync' : 'Saved locally',
    };

    await db.put('projects', toSave);
    return { saved: toSave };
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('projects', id);
  }

  async getStandards(): Promise<StandardReference[]> {
    await this.ensureSeeded();
    const db = await this.getDb();
    return (await db.getAll('standards')) as StandardReference[];
  }

  async saveStandards(standards: StandardReference[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction('standards', 'readwrite');
    await tx.objectStore('standards').clear();
    for (const s of standards) {
      await tx.objectStore('standards').put(s);
    }
    await tx.done;
  }

  async resetDemoData(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(['projects', 'standards', 'meta'], 'readwrite');
    await tx.objectStore('projects').clear();
    await tx.objectStore('standards').clear();
    for (const proj of DEMO_PROJECTS) {
      await tx.objectStore('projects').put(proj);
    }
    for (const std of INITIAL_STANDARD_REFERENCES) {
      await tx.objectStore('standards').put(std);
    }
    await tx.objectStore('meta').put(true, 'seeded_v1');
    await tx.done;
  }

  async getStorageHealth(): Promise<StorageHealthInfo> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        const used = est.usage ?? 0;
        const quota = est.quota ?? 50 * 1024 * 1024;
        const usedPct = quota > 0 ? Math.round((used / quota) * 100) : 0;
        return {
          usedBytes: used,
          quotaBytes: quota,
          usedPct,
          nearLimit: usedPct >= 75,
        };
      }
    } catch {
      // ignore
    }
    return { usedBytes: 0, quotaBytes: 50 * 1024 * 1024, usedPct: 0, nearLimit: false };
  }

  async exportAllJson(): Promise<string> {
    const projects = await this.getProjects();
    const standards = await this.getStandards();
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        mode: 'Demo Local Persistence (IndexedDB)',
        projects,
        standards,
      },
      null,
      2
    );
  }
}

export const surveyRepository: ISurveyRepository = new IndexedDBSurveyRepository();
