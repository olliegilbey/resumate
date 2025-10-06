import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataExplorer } from '../DataExplorer'
import { ResumeData } from '@/types/resume'
import { mockResumeData } from '@/lib/__tests__/fixtures/resume-data.fixture'

// Mock lib/tags module
vi.mock('@/lib/tags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tags')>()
  return {
    ...actual,
    getSortedTags: vi.fn((data: ResumeData) => {
      const tags = new Set<string>()
      data.companies.forEach(company => {
        company.positions.forEach(position => {
          position.bullets.forEach(bullet => {
            bullet.tags.forEach(tag => tags.add(tag))
          })
        })
      })
      return Array.from(tags).sort()
    }),
  }
})

describe('DataExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the header', () => {
    render(<DataExplorer data={mockResumeData} />)
    expect(screen.getByText('Full Experience Compendium')).toBeInTheDocument()
    expect(
      screen.getByText('All achievements and experience, filterable by tag and searchable by keyword.')
    ).toBeInTheDocument()
  })

  it('should render search bar', () => {
    render(<DataExplorer data={mockResumeData} />)
    expect(screen.getByPlaceholderText(/Search experience/i)).toBeInTheDocument()
  })

  it('should display stats correctly', () => {
    render(<DataExplorer data={mockResumeData} />)

    // 4 bullets total (2 from company-1, 2 from company-2)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Bullets')).toBeInTheDocument()

    // 2 companies
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Companies')).toBeInTheDocument()

    // Check for Tags label
    expect(screen.getByText('Tags')).toBeInTheDocument()
  })

  it('should render all companies initially', () => {
    render(<DataExplorer data={mockResumeData} />)
    expect(screen.getByText('Tech Corp')).toBeInTheDocument()
    expect(screen.getByText('Startup Inc')).toBeInTheDocument()
  })

  it('should render all bullets initially', () => {
    render(<DataExplorer data={mockResumeData} />)
    expect(screen.getByText('Reduced deployment time by 50%')).toBeInTheDocument()
    expect(screen.getByText('Mentored 5 junior engineers')).toBeInTheDocument()
    expect(screen.getByText('Launched MVP in 3 months')).toBeInTheDocument()
    expect(screen.getByText('Scaled to 10k users')).toBeInTheDocument()
  })

  it('should filter bullets by search query', async () => {
    const user = userEvent.setup()
    render(<DataExplorer data={mockResumeData} />)

    const searchInput = screen.getByPlaceholderText(/Search experience/i)
    await user.type(searchInput, 'deployment')

    // Should show matching bullet
    expect(screen.getByText('Reduced deployment time by 50%')).toBeInTheDocument()

    // Should hide non-matching bullets
    expect(screen.queryByText('Mentored 5 junior engineers')).not.toBeInTheDocument()
    expect(screen.queryByText('Launched MVP in 3 months')).not.toBeInTheDocument()
    expect(screen.queryByText('Scaled to 10k users')).not.toBeInTheDocument()
  })

  it('should filter by company name', async () => {
    const user = userEvent.setup()
    render(<DataExplorer data={mockResumeData} />)

    const searchInput = screen.getByPlaceholderText(/Search experience/i)
    await user.type(searchInput, 'Startup')

    // Should show Startup Inc bullets
    expect(screen.getByText('Launched MVP in 3 months')).toBeInTheDocument()
    expect(screen.getByText('Scaled to 10k users')).toBeInTheDocument()

    // Should hide Tech Corp bullets
    expect(screen.queryByText('Reduced deployment time by 50%')).not.toBeInTheDocument()
  })

  it('should filter by role', async () => {
    const user = userEvent.setup()
    render(<DataExplorer data={mockResumeData} />)

    const searchInput = screen.getByPlaceholderText(/Search experience/i)
    await user.type(searchInput, 'Senior Engineer')

    // Should show bullets from Senior Engineer role
    expect(screen.getByText('Reduced deployment time by 50%')).toBeInTheDocument()
    expect(screen.getByText('Mentored 5 junior engineers')).toBeInTheDocument()

    // Should hide Full Stack Developer bullets
    expect(screen.queryByText('Launched MVP in 3 months')).not.toBeInTheDocument()
    expect(screen.queryByText('Scaled to 10k users')).not.toBeInTheDocument()
  })

  it('should show "No results found" when search matches nothing', async () => {
    const user = userEvent.setup()
    render(<DataExplorer data={mockResumeData} />)

    const searchInput = screen.getByPlaceholderText(/Search experience/i)
    await user.type(searchInput, 'nonexistent search term xyz')

    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search terms or selected tags.')).toBeInTheDocument()
  })

  it('should clear search when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<DataExplorer data={mockResumeData} />)

    const searchInput = screen.getByPlaceholderText(/Search experience/i)
    await user.type(searchInput, 'deployment')

    // Verify filtering worked
    expect(screen.queryByText('Mentored 5 junior engineers')).not.toBeInTheDocument()

    // Clear search
    const clearButton = screen.getByLabelText('Clear search')
    await user.click(clearButton)

    // All bullets should be visible again
    expect(screen.getByText('Reduced deployment time by 50%')).toBeInTheDocument()
    expect(screen.getByText('Mentored 5 junior engineers')).toBeInTheDocument()
    expect(screen.getByText('Launched MVP in 3 months')).toBeInTheDocument()
    expect(screen.getByText('Scaled to 10k users')).toBeInTheDocument()
  })

  it('should update stats when filtering', async () => {
    const user = userEvent.setup()
    render(<DataExplorer data={mockResumeData} />)

    const searchInput = screen.getByPlaceholderText(/Search experience/i)
    await user.type(searchInput, 'deployment')

    // After filtering to 1 bullet, stats should update
    const bulletCounts = screen.getAllByText('1')
    expect(bulletCounts.length).toBeGreaterThan(0) // Should show "1" for bullets and companies
  })

  it('should sort companies by date (newest first)', () => {
    render(<DataExplorer data={mockResumeData} />)

    const companyNames = screen.getAllByText(/Tech Corp|Startup Inc/)
    // Tech Corp (2022-Present) should appear before Startup Inc (2020-2021)
    expect(companyNames[0]).toHaveTextContent('Tech Corp')
  })

  it('should render TagFilter component', () => {
    render(<DataExplorer data={mockResumeData} />)
    expect(screen.getByText('Filter by Tags')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(<DataExplorer data={mockResumeData} className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should handle empty companies array', () => {
    const emptyData: ResumeData = {
      ...mockResumeData,
      companies: [],
    }

    render(<DataExplorer data={emptyData} />)
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })
})
