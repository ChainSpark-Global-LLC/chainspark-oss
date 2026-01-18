/**
 * Job Posting Extractor
 * 
 * Extracts structured job posting data:
 * - Title, company, location
 * - Requirements and qualifications
 * - Salary information
 * - Benefits
 */

import { z } from "zod";
import { ExtractorConfig } from "../../core";

/**
 * Schema for a job requirement
 */
export const RequirementSchema = z.object({
    text: z.string().describe("The requirement description"),
    type: z.enum(["required", "preferred", "nice_to_have"]).describe("Requirement type"),
});

/**
 * Schema for salary information
 */
export const SalarySchema = z.object({
    min: z.number().nullable().describe("Minimum salary"),
    max: z.number().nullable().describe("Maximum salary"),
    currency: z.string().default("USD").describe("Currency code"),
    period: z.enum(["hourly", "yearly"]).describe("Pay period"),
});

/**
 * Schema for a job posting
 */
export const JobPostingSchema = z.object({
    title: z.string().describe("Job title"),
    company: z.string().describe("Company name"),
    location: z.string().nullable().describe("Job location or 'Remote'"),
    employment_type: z.enum(["full-time", "part-time", "contract", "internship"]).nullable()
        .describe("Type of employment"),
    experience_years: z.number().nullable().describe("Required years of experience"),
    salary: SalarySchema.nullable().describe("Salary information if available"),
    requirements: z.array(RequirementSchema).describe("Job requirements"),
    benefits: z.array(z.string()).describe("Listed benefits"),
    skills: z.array(z.string()).describe("Required/desired skills"),
    confidence: z.number().min(0).max(1).describe("Extraction confidence (0-1)"),
});

export type JobPosting = z.infer<typeof JobPostingSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Salary = z.infer<typeof SalarySchema>;

/**
 * Build the extraction prompt for job postings
 */
export function buildPrompt(text: string): string {
    return `You are an expert at extracting structured data from job postings and career listings.

Extract the job posting information from this text:
- title: The job title
- company: Company name
- location: Location or "Remote" (null if not specified)
- employment_type: "full-time", "part-time", "contract", or "internship" (null if not specified)
- experience_years: Required years of experience (null if not specified)
- salary: Object with min, max, currency, period (null if not provided)
  - Convert ranges like "$80k-$120k" to min: 80000, max: 120000
  - Determine if hourly or yearly based on context
- requirements: Array of requirements with:
  - text: The requirement
  - type: "required", "preferred", or "nice_to_have"
- benefits: Array of benefit strings (health insurance, PTO, etc.)
- skills: Array of technical/soft skills mentioned
- confidence: Your confidence in the overall extraction (0.0 to 1.0)

IMPORTANT:
- Distinguish between required and preferred qualifications
- Parse salary ranges carefully - "$80-100K" means 80000-100000
- Include both technical skills (Python, AWS) and soft skills (communication)
- Extract remote work policies if mentioned

JOB POSTING TEXT:
${text}`;
}

/**
 * Job posting extractor configuration
 */
export const jobPostingExtractor: ExtractorConfig<typeof JobPostingSchema> = {
    name: "job-posting",
    description: "Extract structured data from job postings",
    schema: JobPostingSchema,
    buildPrompt,
};

export default jobPostingExtractor;
