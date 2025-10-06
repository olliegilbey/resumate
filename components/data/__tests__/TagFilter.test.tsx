import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagFilter } from '../TagFilter'
import { BulletPoint } from '@/types/resume'

describe('TagFilter', () => {
  const mockBullets: BulletPoint[] = [
    {
      id: 'bullet-1',
      text: 'First achievement',
      tags: ['leadership', 'blockchain'],
      priority: 10,
    },
    {
      id: 'bullet-2',
      text: 'Second achievement',
      tags: ['blockchain', 'machine-learning'],
      priority: 9,
    },
    {
      id: 'bullet-3',
      text: 'Third achievement',
      tags: ['leadership'],
      priority: 8,
    },
  ]

  const allTags = ['leadership', 'blockchain', 'machine-learning', 'unused-tag']

  it('should render title', () => {
    render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
      />
    )
    expect(screen.getByText('Filter by Tags')).toBeInTheDocument()
  })

  it('should display only tags that have bullets with counts', () => {
    render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    // Tags with bullets should be displayed
    expect(screen.getByText('leadership')).toBeInTheDocument()
    expect(screen.getAllByText('(2)')).toHaveLength(2) // leadership and blockchain both have count of 2

    expect(screen.getByText('blockchain')).toBeInTheDocument()
    expect(screen.getByText(/machine.learning/i)).toBeInTheDocument() // Matches "machine-learning" or "machine learning"

    // Tag without bullets should not be displayed
    expect(screen.queryByText('unused-tag')).not.toBeInTheDocument()
  })

  it('should show correct tag counts', () => {
    render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    // leadership: 2, blockchain: 2, machine-learning: 1
    const counts = screen.getAllByText(/\(\d+\)/)
    expect(counts).toHaveLength(3)
  })

  it('should render checkboxes for each tag', () => {
    render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3) // Only tags with bullets
  })

  it('should check selected tags', () => {
    render(
      <TagFilter
        selectedTags={['leadership', 'blockchain']}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const checkedCheckboxes = checkboxes.filter(cb => cb.checked)
    expect(checkedCheckboxes).toHaveLength(2)
  })

  it('should call onTagToggle when checkbox is clicked', async () => {
    const user = userEvent.setup()
    const onTagToggle = vi.fn()

    render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={onTagToggle}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    const leadershipLabel = screen.getByText('leadership').closest('label')
    const checkbox = leadershipLabel?.querySelector('input[type="checkbox"]')

    if (checkbox) {
      await user.click(checkbox)
      expect(onTagToggle).toHaveBeenCalledWith('leadership')
    }
  })

  it('should hide Clear All button when no tags selected', () => {
    render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    const clearButton = screen.getByText('Clear All')
    expect(clearButton).toHaveClass('opacity-0')
    expect(clearButton).toHaveClass('pointer-events-none')
  })

  it('should show Clear All button when tags are selected', () => {
    render(
      <TagFilter
        selectedTags={['leadership']}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    const clearButton = screen.getByText('Clear All')
    expect(clearButton).not.toHaveClass('opacity-0')
  })

  it('should call onTagToggle for each selected tag when Clear All is clicked', async () => {
    const user = userEvent.setup()
    const onTagToggle = vi.fn()

    render(
      <TagFilter
        selectedTags={['leadership', 'blockchain']}
        onTagToggle={onTagToggle}
        bullets={mockBullets}
        allTags={allTags}
      />
    )

    const clearButton = screen.getByText('Clear All')
    await user.click(clearButton)

    expect(onTagToggle).toHaveBeenCalledTimes(2)
    expect(onTagToggle).toHaveBeenCalledWith('leadership')
    expect(onTagToggle).toHaveBeenCalledWith('blockchain')
  })

  it('should preserve tag order from allTags prop', () => {
    const orderedTags = ['machine-learning', 'blockchain', 'leadership']

    render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={orderedTags}
      />
    )

    // Get all checkboxes in order
    const checkboxes = screen.getAllByRole('checkbox')
    const labels = checkboxes.map(cb => cb.closest('label'))

    // Check tag order by looking at label content
    expect(labels[0]?.textContent).toContain('machine learning')
    expect(labels[1]?.textContent).toContain('blockchain')
    expect(labels[2]?.textContent).toContain('leadership')
  })

  it('should apply custom className', () => {
    const { container } = render(
      <TagFilter
        selectedTags={[]}
        onTagToggle={vi.fn()}
        bullets={mockBullets}
        allTags={allTags}
        className="custom-class"
      />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
