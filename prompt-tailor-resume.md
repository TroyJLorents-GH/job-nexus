---
project: projects/job-nexus
use prompt serves: Asks the Azure Foundry ResumeAgent for the highest-impact edits to tailor a resume to a specific job.
---

# job-nexus - Tailor Resume

User-message prompt built in `api/tailor-resume.mjs` and sent to the Azure AI Foundry `ResumeAgent`. The bracketed tokens are interpolated at runtime: `${jobDescription}`, `${resumeText}`, and the matched/missing skill lists from the prior match step.

```
TAILOR MODE

Job Description:
${jobDescription}

My Resume:
${resumeText}

Matched Skills: ${matchedSkills.join(", ")}
Missing/Weak Skills: ${missingSkills.join(", ")}

Give me your top 3-5 highest-impact changes to tailor this resume for this job.
```
