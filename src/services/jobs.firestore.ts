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
  type UpdateData,
  type DocumentData,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import type {
  JobApplication,
  JobApplicationFormData,
  InterviewPrep,
  StageChange,
  EvaluationSummary,
} from '../types/job'

function getUserId(): string {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.uid
}

function userAppsCollection() {
  return collection(db, 'users', getUserId(), 'applications')
}

/** Firestore rejects `undefined` values; drop those keys instead. */
function stripUndefined(obj: object): UpdateData<DocumentData> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function toIso(ts: Timestamp | string | undefined): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === 'string') return ts
  return ts.toDate().toISOString()
}

/**
 * Older records stored the JD inside `notes` as "Found on <site>

<description>".
 * Recover it so evaluations work on jobs saved before `jobDescription` existed.
 */
function backfillJobDescription(data: Record<string, unknown>): string | undefined {
  const explicit = data.jobDescription as string | undefined
  if (explicit) return explicit
  const notes = data.notes as string | undefined
  if (!notes) return undefined
  const match = notes.match(/^Found on [^\n]*\n\n([\s\S]+)$/)
  return match ? match[1].trim() || undefined : undefined
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
    jobDescription: backfillJobDescription(data),
    jobPostingId: data.jobPostingId as string | undefined,
    resumeDocumentId: data.resumeDocumentId as string | undefined,
    source: data.source as string | undefined,
    sourceJobId: data.sourceJobId as string | undefined,
    stageHistory: (data.stageHistory as StageChange[]) ?? undefined,
    rejectedAtStage: data.rejectedAtStage as JobApplication['rejectedAtStage'],
    evaluation: data.evaluation as EvaluationSummary | undefined,
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
    const stage = data.stage || 'applied'
    // A saved-but-not-applied job has no application date yet.
    const appliedDate = data.appliedDate ?? (stage === 'saved' ? '' : nowIso.split('T')[0])
    const stageHistory: StageChange[] = [{ stage, at: nowIso }]

    const docRef = await addDoc(userAppsCollection(), {
      ...stripUndefined(data),
      appliedDate,
      stage,
      status: data.status || 'active',
      interviewPrep: [],
      stageHistory,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return {
      id: docRef.id,
      company: data.company ?? '',
      position: data.position ?? '',
      appliedDate,
      stage,
      status: data.status || 'active',
      salary: data.salary,
      location: data.location,
      jobUrl: data.jobUrl,
      notes: data.notes,
      interviewPrep: [],
      jobDescription: data.jobDescription,
      jobPostingId: data.jobPostingId,
      resumeDocumentId: data.resumeDocumentId,
      source: data.source,
      sourceJobId: data.sourceJobId,
      stageHistory,
      evaluation: data.evaluation,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  },

  async updateJobApplication(id: string, patch: Partial<JobApplicationFormData>): Promise<JobApplication> {
    const ref = doc(db, 'users', getUserId(), 'applications', id)
    const update: UpdateData<DocumentData> = {
      ...stripUndefined(patch),
      updatedAt: serverTimestamp(),
    }

    // Record stage transitions so we can compute funnel stats and rejection stage later.
    if (patch.stage) {
      const current = await api.getJobApplication(id)
      if (current.stage !== patch.stage) {
        const history = current.stageHistory ?? [{ stage: current.stage, at: current.createdAt }]
        update.stageHistory = [...history, { stage: patch.stage, at: new Date().toISOString() }]
        if (patch.stage === 'rejected' && !current.rejectedAtStage) {
          update.rejectedAtStage = current.stage
        }
        if (patch.stage !== 'saved' && !current.appliedDate) {
          update.appliedDate = new Date().toISOString().split('T')[0]
        }
      }
    }

    await updateDoc(ref, update)
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
