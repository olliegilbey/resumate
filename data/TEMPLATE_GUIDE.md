# Resume Data Template Guide

## Overview
This guide explains how to structure your resume data for the Resumate system.

## File Structure
Your resume data should be saved as `resume-data.json` in the `data/` directory.

---

## Available Tags

Tags help categorize your experience bullets for filtering and AI curation. Use these **18 standardized tags** (consolidated for clarity):

### Core Role Tags (What you do)
- `developer-relations` - DevRel, developer advocacy, developer experience, community engagement
- `product-management` - Product strategy, roadmaps, requirements, pricing, GTM
- `technical-leadership` - Technical direction, architecture, engineering, consulting
- `business-development` - Partnerships, sales, deals, grants

### Key Activities (How you work)
- `community-building` - Building/nurturing communities, social media, culture, D&I
- `event-management` - Organizing events, hackathons, conferences, webinars
- `public-speaking` - Presentations, talks, training, education
- `technical-writing` - Documentation, blog posts, tutorials, content
- `team-leadership` - People management, hiring, mentoring, scrum/agile, crisis management
- `cross-functional` - Working across teams, coordination
- `strategic-planning` - Strategy, vision, long-term planning, research, launches

### Technical Domains
- `blockchain` - Blockchain, crypto, Web3, Ethereum, Solidity, DAGs
- `machine-learning` - ML, AI, data science, Python, GoLang
- `growth-engineering` - Growth hacking, optimization, automation, tooling, web scraping
- `data-driven` - Analytics, metrics, measurement, A/B testing, SEO

### Specialized
- `entrepreneurship` - Startups, founding, side projects, innovation, speed
- `ecosystem-building` - Growing platforms, networks, ecosystems, expansion
- `content-creation` - Video, design, UI, marketing, visualization

---

## Field Definitions

### Personal Info
```json
{
  "name": "Preferred short name",
  "fullName": "Full legal name",
  "email": "Contact email",
  "phone": "Phone with country code",
  "location": "City - Region",
  "citizenship": ["Array of citizenships"],
  "linkedin": "LinkedIn username (not full URL)",
  "github": "GitHub username (not full URL)",
  "website": "Your website domain"
}
```

### Companies
Experience is organized hierarchically: **Company → Position → Bullets**

#### Company Level
- **id**: Unique identifier (e.g., `company-short-name`)
- **name**: Company or organization name
- **dateRange**: Overall date range from first to last position (e.g., "Jan 2020 – Present")
- **location** _(optional)_: Company location (e.g., "London - Remote")
- **context** _(optional)_: Company description or context (e.g., "Web3 Cloud Infrastructure")

#### Position Level
Each position within a company includes:

- **id**: Unique identifier (e.g., `company-role-id`)
- **role**: Your job title at this position
- **dateRange**: Date range for this specific position (e.g., "Jun 2021 – Present")
- **description**: The main bullet describing this role (your primary responsibility or achievement)
- **descriptionTags**: Array of 2-5 relevant tags from the list above
- **descriptionPriority**: Number 1-10 (10 = most important)
- **descriptionMetrics** _(optional)_: Extracted quantifiable metric
- **descriptionContext** _(optional)_: Background info for AI curation
- **descriptionLink** _(optional)_: URL to recording, article, or project
- **bullets**: Array of additional achievement bullets for this position

#### Bullet Level
Additional achievements within a position:

- **id**: Unique identifier (e.g., `company-role-achievement`)
- **text**: Your exact bullet point text (keep original wording!)
- **tags**: Array of 2-5 relevant tags from the list above
- **priority**: Number 1-10 (10 = most important)
- **metrics** _(optional)_: Extracted quantifiable metric (e.g., "10x increase", "1.9M entries")
- **context** _(optional)_: Background info for AI curation
- **link** _(optional)_: URL to recording, article, or project

### Priority Guidelines
- **10**: Career-defining achievements, major launches, team building
- **9**: Significant promotions, important projects
- **8**: Solid achievements with clear impact
- **7**: Good contributions, standard responsibilities
- **6 or below**: Supporting details, general activities

### Education
```json
{
  "degree": "Full degree name",
  "degreeType": "BSc/BA/BComm/MSc/etc",
  "institution": "University name",
  "location": "City, Country",
  "year": "Graduation year (YYYY)",
  "coursework": ["Optional: relevant courses"],
  "societies": ["Optional: clubs, organizations"]
}
```

### Accomplishments
Side projects, awards, certifications:
```json
{
  "id": "unique-id",
  "title": "Award/Achievement name",
  "description": "Brief description",
  "year": "YYYY",
  "tags": ["Optional: relevant tags"]
}
```

---

## Tips

1. **Keep text verbatim**: Don't rewrite your bullets - use the exact wording from your original resume
2. **Extract metrics**: Pull out numbers into the `metrics` field for visual emphasis
3. **Add context**: Use the `context` field to add information that would help AI understand the achievement
4. **Tag thoughtfully**: Choose 2-5 most relevant tags per bullet
5. **Prioritize honestly**: Use the full 1-10 scale, not just 8-10
6. **Date format**: Use "Month Year – Month Year" with em dash (–) not hyphen (-)
7. **Current roles**: Use "Present" or "Current" as the end date

---

## Example Company Structure

```json
{
  "id": "acme-corp",
  "name": "Acme Corp",
  "dateRange": "January 2020 – Present",
  "location": "San Francisco - Remote",
  "context": "Leading developer tools platform",
  "positions": [
    {
      "id": "acme-devrel-lead",
      "role": "Developer Relations Lead",
      "dateRange": "June 2021 – Present",
      "description": "Led developer community growth from 500 to 50,000 members by implementing data-driven engagement strategies and hosting 100+ events across 15 countries",
      "descriptionTags": ["developer-relations", "community-building", "data-driven", "event-management"],
      "descriptionPriority": 10,
      "descriptionMetrics": "50,000 members, 100+ events",
      "descriptionContext": "First DevRel hire, built team from 1 to 8 people",
      "descriptionLink": "https://example.com/talk",
      "bullets": [
        {
          "id": "acme-devrel-content",
          "text": "Created technical content strategy that increased documentation engagement by 300% and reduced support tickets by 40%",
          "tags": ["technical-writing", "content-creation", "data-driven"],
          "priority": 8,
          "metrics": "300% increase, 40% reduction",
          "context": "Completely revamped docs and created video tutorial series"
        }
      ]
    },
    {
      "id": "acme-devrel-eng",
      "role": "Developer Advocate",
      "dateRange": "January 2020 – May 2021",
      "description": "Established developer advocacy function, creating technical demos and sample applications that became the foundation for product documentation",
      "descriptionTags": ["developer-relations", "technical-leadership", "content-creation"],
      "descriptionPriority": 7,
      "bullets": []
    }
  ]
}
```

**Note**: This example shows a company with two positions (promotion from Developer Advocate to Lead), similar to how LinkedIn displays role progression within the same company.

---

## Validation

After creating your `resume-data.json`:
1. Run `npm run build` to check for TypeScript errors
2. Start dev server with `npm run dev`
3. Visit `/resume/view` to see your data
4. Test search and filtering functionality