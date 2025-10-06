import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../SearchBar'

describe('SearchBar', () => {
  it('should render with default placeholder', () => {
    render(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Search experience...')).toBeInTheDocument()
  })

  it('should render with custom placeholder', () => {
    render(<SearchBar value="" onChange={vi.fn()} placeholder="Custom placeholder" />)
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })

  it('should display the current value', () => {
    render(<SearchBar value="test query" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('test query')).toBeInTheDocument()
  })

  it('should call onChange when typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)

    const input = screen.getByPlaceholderText('Search experience...')
    await user.type(input, 'test')

    // user.type triggers onChange for each character typed
    expect(onChange).toHaveBeenCalled()
    // Check the calls include the right characters
    expect(onChange).toHaveBeenCalledWith('t')
    expect(onChange).toHaveBeenCalledWith('e')
    expect(onChange).toHaveBeenCalledWith('s')
    expect(onChange).toHaveBeenCalledWith('t')
  })

  it('should show clear button when value is not empty', () => {
    render(<SearchBar value="search text" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('should not show clear button when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('should call onChange with empty string when clear button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchBar value="some search" onChange={onChange} />)

    const clearButton = screen.getByLabelText('Clear search')
    await user.click(clearButton)

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('should have search icon', () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} />)
    // lucide-react icons render as SVG with specific class
    const searchIcon = container.querySelector('svg')
    expect(searchIcon).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(<SearchBar value="" onChange={vi.fn()} className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
