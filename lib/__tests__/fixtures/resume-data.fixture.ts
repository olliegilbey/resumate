import { ResumeData } from '@/types/resume'

/**
 * Minimal test fixture for resume data
 * Used for unit testing without relying on gist data
 */
export const mockResumeData: ResumeData = {
  personal: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '+1234567890',
    location: 'San Francisco, CA',
    linkedin: 'testuser',
    github: 'testuser',
    website: 'https://testuser.com',
  },
  summary: 'Experienced professional with diverse background',
  experience: [
    {
      id: 'company-1',
      name: 'Tech Corp',
      dateStart: '2022-01',
      location: 'Remote',
      description: 'Cloud Infrastructure',
      priority: 10,
      tags: ['tech', 'cloud'],
      children: [
        {
          id: 'pos-1',
          name: 'Senior Engineer',
          dateStart: '2022-01',
          description: 'Led infrastructure initiatives',
          tags: ['leadership', 'cloud'],
          priority: 9,
          children: [
            {
              id: 'bullet-1',
              description: 'Reduced deployment time by 50%',
              tags: ['performance', 'devops'],
              priority: 10,
            },
            {
              id: 'bullet-2',
              description: 'Mentored 5 junior engineers',
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
      dateStart: '2020-06',
      dateEnd: '2021-12',
      priority: 8,
      tags: ['startup'],
      children: [
        {
          id: 'pos-2',
          name: 'Full Stack Developer',
          dateStart: '2020-06',
          dateEnd: '2021-12',
          description: 'Built product from scratch',
          tags: ['full-stack', 'product'],
          priority: 7,
          children: [
            {
              id: 'bullet-3',
              description: 'Launched MVP in 3 months',
              tags: ['product', 'full-stack'],
              priority: 9,
            },
            {
              id: 'bullet-4',
              description: 'Scaled to 10k users',
              tags: ['scalability', 'backend'],
              priority: 8,
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
      degree: 'Bachelor of Science in Computer Science',
      degreeType: 'BSc',
      institution: 'State University',
      location: 'California, USA',
      year: '2020',
      coursework: ['Data Structures', 'Algorithms', 'Systems'],
    },
  ],
  roleProfiles: [
    {
      id: 'software-engineer',
      name: 'Software Engineer',
      description: 'Full-stack engineering role',
      tagWeights: {
        engineering: 1.0,
        'full-stack': 0.9,
        backend: 0.8,
        performance: 0.7,
      },
      scoringWeights: {
        tagRelevance: 0.6,
        priority: 0.4,
      },
    },
  ],
}
