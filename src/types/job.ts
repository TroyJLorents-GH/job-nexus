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
  createdAt: string;
  updatedAt: string;
}

export type JobStage =
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
}
