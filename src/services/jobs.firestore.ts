import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import type { JobApplication, JobApplicationFormData, InterviewPrep } from '../types/job'

function getUserId(): string {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.uid
}

function userAppsCollection() {
  return collection(db, 'users', getUserId(), 'applications')
}

function toIso(ts: Timestamp | string | undefined): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === 'string') return ts
  return ts.toDate().toISOString()
}

// Firestore doc → JobApplication
function fromDoc(id: string, data: Record<string, unknown>): JobApplication {
  return {
    id,
    company: (data.company as string) ?? '',
    position: (data.position as string) ?? '',
    appliedDate: (data.appliedDate as string) ?? '',
    stage: (data.stage as JobApplication['stage']) ?? 'applied',
    status: (data.status as JobApplication['status']) ?? 'active',
    salary: data.salary as string | undefined,
    location: data.location as string | undefined,
    jobUrl: data.jobUrl as string | undefined,
    notes: data.notes as string | undefined,
    interviewPrep: (data.interviewPrep as InterviewPrep[]) ?? [],
    createdAt: toIso(data.createdAt as Timestamp | string | undefined),
    updatedAt: toIso(data.updatedAt as Timestamp | string | undefined),
  }
}

export const api = {
  async getJobApplications(): Promise<JobApplication[]> {
    const q = query(userAppsCollection(), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => fromDoc(d.id, d.data()))
  },

  async getJobApplication(id: string): Promise<JobApplication> {
    const ref = doc(db, 'users', getUserId(), 'applications', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error('Job application not found')
    return fromDoc(snap.id, snap.data())
  },

  async createJobApplication(data: JobApplicationFormData): Promise<JobApplication> {
    const nowIso = new Date().toISOString()
    const docRef = await addDoc(userAppsCollection(), {
      ...data,
      appliedDate: data.appliedDate || nowIso.split('T')[0],
      stage: data.stage || 'applied',
      status: data.status || 'active',
      interviewPrep: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return {
      id: docRef.id,
      company: data.company ?? '',
      position: data.position ?? '',
      appliedDate: data.appliedDate || nowIso.split('T')[0],
      stage: data.stage || 'applied',
      status: data.status || 'active',
      salary: data.salary,
      location: data.location,
      jobUrl: data.jobUrl,
      notes: data.notes,
      interviewPrep: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  },

  async updateJobApplication(id: string, patch: Partial<JobApplicationFormData>): Promise<JobApplication> {
    const ref = doc(db, 'users', getUserId(), 'applications', id)
    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    })
    return api.getJobApplication(id)
  },

  async deleteJobApplication(id: string): Promise<void> {
    const ref = doc(db, 'users', getUserId(), 'applications', id)
    await deleteDoc(ref)
  },

  async addInterviewPrep(id: string, title: string, content: string): Promise<JobApplication> {
    const job = await api.getJobApplication(id)
    const newPrep: InterviewPrep = {
      id: crypto.randomUUID(),
      title,
      content,
      createdAt: new Date().toISOString(),
    }
    const updatedPrep = [...(job.interviewPrep || []), newPrep]
    const ref = doc(db, 'users', getUserId(), 'applications', id)
    await updateDoc(ref, {
      interviewPrep: updatedPrep,
      updatedAt: serverTimestamp(),
    })
    return api.getJobApplication(id)
  },
}
