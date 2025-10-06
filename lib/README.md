# Library Utilities

Core utility functions for Resumate.

## Tag Management (`tags.ts`)

### Tag Sorting Algorithm

Tags are sorted by **weight** to prioritize the most important and frequently used tags.

**Weight Formula:**
```
weight = count × avgPriority
```

**Sorting Order:**
1. **Primary:** Weight (descending) - highest weight first
2. **Secondary:** Count (descending) - more frequent tags win ties
3. **Tertiary:** Alphabetical (ascending) - deterministic tiebreaker

**Example:**
```typescript
Tag A: 10 occurrences × priority 8 = weight 80
Tag B: 5 occurrences × priority 10 = weight 50
Tag C: 12 occurrences × priority 6 = weight 72

Sorted order: A (80) → C (72) → B (50)
```

**Priority Defaults:**
- Missing or zero priorities default to **5** (mid-range on 1-10 scale)
- Prevents tags from being hidden when priority isn't explicitly set
- Applies to bullets, position descriptions, and accomplishments

### Why This Matters

**Color Consistency:**
- Tag colors are based on array index
- Single sorted tag list ensures consistent colors across:
  - Filter sidebar
  - Bullet cards
  - Search results

**UX Benefits:**
- Most important tags appear first in filters
- Users see highest-value filters immediately
- Balances frequency (common) with importance (high priority)

### Functions

#### `getSortedTagsWithMetrics(data: ResumeData): TagMetrics[]`
Returns full metrics for all tags, sorted by weight.

**Returns:**
```typescript
interface TagMetrics {
  tag: string
  count: number          // Number of occurrences
  totalPriority: number  // Sum of priorities
  avgPriority: number    // Average priority
  weight: number         // count × avgPriority
}
```

**Use case:** Analytics, debugging, understanding tag distribution

#### `getSortedTags(data: ResumeData): string[]`
Returns simple array of tag strings, sorted by weight.

**Use case:** Primary function for tag display ordering (used in DataExplorer)

#### `extractAllTags(data: ResumeData): string[]` (deprecated)
Returns alphabetically sorted tags.

**Status:** Deprecated in favor of `getSortedTags()` for priority-weighted sorting.

#### `getTagColorClass(tag: string, allTags: string[]): string`
Returns Tailwind color classes based on tag's position in sorted array.

**Returns:** `'bg-tag-N text-tag-N'` where N is `index % 20` (cycles through 20 colors)

**Important:** `allTags` must be the consistently sorted array from `getSortedTags()` for color consistency.

### Testing

See `lib/__tests__/tags.test.ts` for comprehensive test coverage:
- Tag extraction
- Color class mapping
- Sorting algorithm verification
- Priority default handling
- Consistency checks

Run tests: `npm test`
