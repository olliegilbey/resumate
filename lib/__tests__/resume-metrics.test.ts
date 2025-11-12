import { describe, it, expect } from 'vitest'
import { getTotalBullets, getTotalPositions, getResumeMetrics } from '../resume-metrics'
import type { Company, ResumeData, Position, BulletPoint } from '@/types/resume'

// Test helpers - create minimal valid objects
const createBullet = (id: string, description: string): BulletPoint => ({
  id,
  description,
  tags: [],
  priority: 5,
})

const createPosition = (id: string, name: string, dateStart: string, children: BulletPoint[] = []): Position => ({
  id,
  name,
  dateStart,
  priority: 5,
  tags: [],
  children,
})

const createCompany = (id: string, name: string, dateStart: string, children: Position[] = []): Company => ({
  id,
  name,
  dateStart,
  priority: 5,
  tags: [],
  children,
})

describe('resume-metrics', () => {
  describe('getTotalBullets', () => {
    it('counts bullets correctly across multiple companies and positions', () => {
      const companies: Company[] = [
        {
          id: 'company1',
          name: 'Company 1',
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: [
            {
              id: 'pos1',
              name: 'Position 1',
              dateStart: '2020',
              priority: 5,
              tags: [],
              children: [
                { id: 'b1', description: 'Bullet 1', tags: [], priority: 5 },
                { id: 'b2', description: 'Bullet 2', tags: [], priority: 5 },
              ],
            },
            {
              id: 'pos2',
              name: 'Position 2',
              dateStart: '2021',
              priority: 5,
              tags: [],
              children: [
                { id: 'b3', description: 'Bullet 3', tags: [], priority: 5 },
              ],
            },
          ],
        },
        {
          id: 'company2',
          name: 'Company 2',
          dateStart: '2022',
          priority: 5,
          tags: [],
          children: [
            {
              id: 'pos3',
              name: 'Position 3',
              dateStart: '2022',
              priority: 5,
              tags: [],
              children: [
                { id: 'b4', description: 'Bullet 4', tags: [], priority: 5 },
                { id: 'b5', description: 'Bullet 5', tags: [], priority: 5 },
              ],
            },
          ],
        },
      ]

      const total = getTotalBullets(companies)
      expect(total).toBe(5) // 2 + 1 + 2
    })

    it('returns 0 for empty companies array', () => {
      const total = getTotalBullets([])
      expect(total).toBe(0)
    })

    it('returns 0 for companies with no positions', () => {
      const companies: Company[] = [
        {
          id: 'company1',
          name: 'Company 1',
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: [],
        },
      ]

      const total = getTotalBullets(companies)
      expect(total).toBe(0)
    })

    it('returns 0 for positions with no bullets', () => {
      const companies: Company[] = [
        {
          id: 'company1',
          name: 'Company 1',
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: [
            {
              id: 'pos1',
              name: 'Position 1',
              dateStart: '2020',
              priority: 5,
              tags: [],
              children: [],
            },
          ],
        },
      ]

      const total = getTotalBullets(companies)
      expect(total).toBe(0)
    })

    it('handles deeply nested structures with many bullets', () => {
      const companies: Company[] = [
        {
          id: 'company1',
          name: 'Company 1',
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: Array.from({ length: 5 }, (_, posIdx) => ({
            id: `pos${posIdx}`,
            name: `Position ${posIdx}`,
            dateStart: '2020',
            priority: 5,
            tags: [],
            children: Array.from({ length: 10 }, (_, bulletIdx) => ({
              id: `b${posIdx}-${bulletIdx}`,
              description: `Bullet ${bulletIdx}`,
              tags: [],
              priority: 5,
            })),
          })),
        },
      ]

      const total = getTotalBullets(companies)
      expect(total).toBe(50) // 5 positions × 10 bullets each
    })
  })

  describe('getTotalPositions', () => {
    it('counts positions correctly across multiple companies', () => {
      const companies: Company[] = [
        {
          id: 'company1',
          name: 'Company 1',
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: [
            { id: 'pos1', name: 'Position 1', dateStart: '2020', priority: 5, tags: [], children: [] },
            { id: 'pos2', name: 'Position 2', dateStart: '2021', priority: 5, tags: [], children: [] },
          ],
        },
        {
          id: 'company2',
          name: 'Company 2',
          dateStart: '2022',
          priority: 5,
          tags: [],
          children: [
            { id: 'pos3', name: 'Position 3', dateStart: '2022', priority: 5, tags: [], children: [] },
          ],
        },
      ]

      const total = getTotalPositions(companies)
      expect(total).toBe(3) // 2 + 1
    })

    it('returns 0 for empty companies array', () => {
      const total = getTotalPositions([])
      expect(total).toBe(0)
    })

    it('returns 0 for companies with no positions', () => {
      const companies: Company[] = [
        {
          id: 'company1',
          name: 'Company 1',
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: [],
        },
      ]

      const total = getTotalPositions(companies)
      expect(total).toBe(0)
    })

    it('counts positions even if they have no bullets', () => {
      const companies: Company[] = [
        {
          id: 'company1',
          name: 'Company 1',
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: [
            { id: 'pos1', name: 'Position 1', dateStart: '2020', priority: 5, tags: [], children: [] },
            { id: 'pos2', name: 'Position 2', dateStart: '2021', priority: 5, tags: [], children: [] },
          ],
        },
      ]

      const total = getTotalPositions(companies)
      expect(total).toBe(2)
    })
  })

  describe('getResumeMetrics', () => {
    it('calculates all metrics correctly', () => {
      const data: ResumeData = {
        personal: {
          name: 'Test User',
          email: 'test@example.com',
        },
        experience: [
          {
            id: 'company1',
            name: 'Company 1',
            dateStart: '2020',
            priority: 5,
            tags: [],
            children: [
              {
                id: 'pos1',
                name: 'Position 1',
                dateStart: '2020',
                priority: 5,
                tags: [],
                children: [
                  { id: 'b1', description: 'Bullet 1', tags: [], priority: 5 },
                  { id: 'b2', description: 'Bullet 2', tags: [], priority: 5 },
                ],
              },
            ],
          },
          {
            id: 'company2',
            name: 'Company 2',
            dateStart: '2021',
            priority: 5,
            tags: [],
            children: [
              {
                id: 'pos2',
                name: 'Position 2',
                dateStart: '2021',
                priority: 5,
                tags: [],
                children: [
                  { id: 'b3', description: 'Bullet 3', tags: [], priority: 5 },
                ],
              },
              {
                id: 'pos3',
                name: 'Position 3',
                dateStart: '2022',
                priority: 5,
                tags: [],
                children: [],
              },
            ],
          },
        ],
      }

      const metrics = getResumeMetrics(data)

      expect(metrics.totalCompanies).toBe(2)
      expect(metrics.totalPositions).toBe(3)
      expect(metrics.totalBullets).toBe(3)
    })

    it('handles resume with no experience', () => {
      const data: ResumeData = {
        personal: {
          name: 'Test User',
          email: 'test@example.com',
        },
        experience: [],
      }

      const metrics = getResumeMetrics(data)

      expect(metrics.totalCompanies).toBe(0)
      expect(metrics.totalPositions).toBe(0)
      expect(metrics.totalBullets).toBe(0)
    })

    it('handles resume with companies but no positions', () => {
      const data: ResumeData = {
        personal: {
          name: 'Test User',
          email: 'test@example.com',
        },
        experience: [
          {
            id: 'company1',
            name: 'Company 1',
            dateStart: '2020',
            priority: 5,
            tags: [],
            children: [],
          },
          {
            id: 'company2',
            name: 'Company 2',
            dateStart: '2021',
            priority: 5,
            tags: [],
            children: [],
          },
        ],
      }

      const metrics = getResumeMetrics(data)

      expect(metrics.totalCompanies).toBe(2)
      expect(metrics.totalPositions).toBe(0)
      expect(metrics.totalBullets).toBe(0)
    })

    it('returns consistent metrics for large datasets', () => {
      const data: ResumeData = {
        personal: {
          name: 'Test User',
          email: 'test@example.com',
        },
        experience: Array.from({ length: 10 }, (_, companyIdx) => ({
          id: `company${companyIdx}`,
          name: `Company ${companyIdx}`,
          dateStart: '2020',
          priority: 5,
          tags: [],
          children: Array.from({ length: 3 }, (_, posIdx) => ({
            id: `pos${companyIdx}-${posIdx}`,
            name: `Position ${posIdx}`,
            dateStart: '2020',
            priority: 5,
            tags: [],
            children: Array.from({ length: 5 }, (_, bulletIdx) => ({
              id: `b${companyIdx}-${posIdx}-${bulletIdx}`,
              description: `Bullet ${bulletIdx}`,
              tags: [],
              priority: 5,
            })),
          })),
        })),
      }

      const metrics = getResumeMetrics(data)

      expect(metrics.totalCompanies).toBe(10)
      expect(metrics.totalPositions).toBe(30) // 10 companies × 3 positions
      expect(metrics.totalBullets).toBe(150) // 30 positions × 5 bullets
    })
  })
})
