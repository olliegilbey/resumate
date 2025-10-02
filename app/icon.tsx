import { ImageResponse } from 'next/og'
import resumeData from '@/data/resume-data.json'

// Route segment config
export const runtime = 'edge'
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Generate initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Image generation
export default function Icon() {
  const initials = getInitials(resumeData.personal.name)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {initials}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
