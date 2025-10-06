import { ResumeData } from '@/types/resume'

/**
 * Minimal test fixture for resume data
 * Used for unit testing without relying on gist data
 */
export const mockResumeData: ResumeData = {
  personal: {
    name: 'Test User',
    fullName: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
    location: 'San Francisco, CA',
    citizenship: ['US'],
    linkedin: 'https://linkedin.com/in/testuser',
    github: 'https://github.com/testuser',
    website: 'https://testuser.com',
    calendar: 'https://cal.com/testuser',
  },
  summary: 'Experienced professional with diverse background',
  tagline: 'Build things that matter',
  companies: [
    {
      id: 'company-1',
      name: 'Tech Corp',
      dateRange: 'Jan 2022 – Present',
      location: 'Remote',
      context: 'Cloud Infrastructure',
      positions: [
        {
          id: 'pos-1',
          role: 'Senior Engineer',
          dateRange: 'Jan 2022 – Present',
          description: 'Led infrastructure initiatives',
          descriptionTags: ['leadership', 'cloud'],
          descriptionPriority: 9,
          bullets: [
            {
              id: 'bullet-1',
              text: 'Reduced deployment time by 50%',
              tags: ['performance', 'devops'],
              priority: 10,
              metrics: '50%',
            },
            {
              id: 'bullet-2',
              text: 'Mentored 5 junior engineers',
              tags: ['leadership', 'mentorship'],
              priority: 8,
            },
          ],
        },
      ],
    },
    {
      id: 'company-2',
      name: 'Startup Inc',
      dateRange: 'Jun 2020 – Dec 2021',
      positions: [
        {
          id: 'pos-2',
          role: 'Full Stack Developer',
          dateRange: 'Jun 2020 – Dec 2021',
          description: 'Built product from scratch',
          descriptionTags: ['full-stack', 'product'],
          descriptionPriority: 7,
          bullets: [
            {
              id: 'bullet-3',
              text: 'Launched MVP in 3 months',
              tags: ['product', 'full-stack'],
              priority: 9,
              metrics: '3 months',
            },
            {
              id: 'bullet-4',
              text: 'Scaled to 10k users',
              tags: ['scalability', 'backend'],
              priority: 8,
              metrics: '10k',
            },
          ],
        },
      ],
    },
  ],
  skills: {
    technical: ['TypeScript', 'React', 'Node.js', 'Rust'],
    soft: ['Leadership', 'Communication', 'Problem Solving'],
  },
  education: [
    {
      degree: 'Computer Science',
      degreeType: 'BSc',
      institution: 'State University',
      location: 'California',
      year: '2020',
    },
  ],
  accomplishments: [
    {
      id: 'acc-1',
      title: 'Open Source Contributor',
      description: 'Contributed to major open source projects',
      year: '2021',
      tags: ['open-source', 'community'],
    },
  ],
  interests: ['Rock Climbing', 'Photography', 'Open Source'],
}
