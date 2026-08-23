export interface JobApplication {
  id: string;
  company: string;
  position: string;
  appliedDate: string;
  stage: JobStage;
  status: JobStatus;
  salary?: string;
  location?: string;
  jobUrl?: string;
  notes?: string;
  interviewPrep?: InterviewPrep[];
  /** Full job description text. Kept out of `notes` so evaluations can use it. */
  jobDescription?: string;
  /** Supabase job_postings row this application came from (set once evaluations land). */
  jobPostingId?: string;
  /** Supabase documents.id of the resume used for the saved evaluation. */
  resumeDocumentId?: string;
  /** Where the posting came from: 'greenhouse' | 'lever' | 'ashby' | 'url' | aggregator name. */
  source?: string;
  /** Board-native job id, used to re-check whether the posting is still live. */
  sourceJobId?: string;
  /** Append-only stage transitions. Powers funnel stats and rejection-stage analysis. */
  stageHistory?: StageChange[];
  /** Stage the application was in when it was rejected. */
  rejectedAtStage?: JobStage;
  /** Snapshot of the latest fit evaluation, denormalized for list/detail rendering. */
  evaluation?: EvaluationSummary;
  createdAt: string;
  updatedAt: string;
}

export type JobStage =
  | 'saved'
  | 'applied'
  | 'phone_screen'
  | 'technical_interview'
  | 'onsite_interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type JobStatus =
  | 'active'
  | 'inactive'
  | 'archived';

export interface StageChange {
  stage: JobStage;
  at: string;
}

export type EvaluationVerdict = 'apply' | 'stretch' | 'skip';

export interface EvaluationSummary {
  /** 1-5, half steps. */
  score: number;
  verdict: EvaluationVerdict;
  evaluatedAt: string;
  documentId?: string;
  matchedCount?: number;
  totalRequirements?: number;
}

export interface InterviewPrep {
  id?: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface JobApplicationFormData {
  company: string;
  position: string;
  appliedDate?: string;
  stage?: JobStage;
  status?: JobStatus;
  salary?: string;
  location?: string;
  jobUrl?: string;
  notes?: string;
  interviewPrep?: InterviewPrep[];
  jobDescription?: string;
  jobPostingId?: string;
  resumeDocumentId?: string;
  source?: string;
  sourceJobId?: string;
  stageHistory?: StageChange[];
  rejectedAtStage?: JobStage;
  evaluation?: EvaluationSummary;
}
