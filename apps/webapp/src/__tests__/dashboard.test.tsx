import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient, mockHealthData, mockConfigData } from './setup'

// Mock the queries module
vi.mock('../lib/queries', () => ({
  useHealth: vi.fn(),
  useConfig: vi.fn(),
  useProcessingLogs: vi.fn(),
  useAppLogs: vi.fn(),
}))

// Mock the events hook
vi.mock('../hooks/use-app-events', () => ({
  useAppEvents: vi.fn(),
}))

// Import after mocking
import { useHealth, useConfig, useProcessingLogs, useAppLogs } from '../lib/queries'
import { useAppEvents } from '../hooks/use-app-events'
// Import the Route to get the component
import { Route } from '../routes/index'

const mockUseHealth = useHealth as ReturnType<typeof vi.fn>
const mockUseConfig = useConfig as ReturnType<typeof vi.fn>
const mockUseProcessingLogs = useProcessingLogs as ReturnType<typeof vi.fn>
const mockUseAppLogs = useAppLogs as ReturnType<typeof vi.fn>
const mockUseAppEvents = useAppEvents as ReturnType<typeof vi.fn>

// Get the component from the Route
const DashboardPage = Route.options.component!

function setupDefaultMocks() {
  mockUseHealth.mockReturnValue({
    data: mockHealthData.healthy,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    dataUpdatedAt: Date.now(),
  })
  mockUseConfig.mockReturnValue({
    data: mockConfigData.default,
    isLoading: false,
  })
  mockUseProcessingLogs.mockReturnValue({
    data: [],
    isLoading: false,
  })
  mockUseAppLogs.mockReturnValue({
    data: [],
    isLoading: false,
  })
  mockUseAppEvents.mockReturnValue({
    processingLogs: [],
    appLogs: [],
    isLoading: false,
  })
}

function renderDashboard() {
  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  )
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton initially', async () => {
    setupDefaultMocks()
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    })

    renderDashboard()

    // Should show loading state
    expect(screen.getByText(/loading system status/i)).toBeInTheDocument()
  })

  it('displays health data when loaded', async () => {
    setupDefaultMocks()

    renderDashboard()

    // Should show healthy status
    expect(screen.getByText('Healthy')).toBeInTheDocument()

    // Should show connected status for Paperless
    expect(screen.getByText('Connected')).toBeInTheDocument()

    // Should show integration stats
    expect(screen.getByText(/integration statistics/i)).toBeInTheDocument()
    expect(screen.getByText('Detected')).toBeInTheDocument()
    expect(screen.getByText('Processed')).toBeInTheDocument()
  })

  it('shows error state on API failure', async () => {
    setupDefaultMocks()
    mockUseHealth.mockReturnValue({
      data: mockHealthData.unhealthy,
      isLoading: false,
      isError: true,
      error: new Error('API error'),
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    })

    renderDashboard()

    // Should show unhealthy status
    expect(screen.getByText('Unhealthy')).toBeInTheDocument()

    // Should show error messages
    expect(screen.getByText(/Paperless connection\/stats failed/i)).toBeInTheDocument()
  })

  it('refresh button triggers refetch', async () => {
    setupDefaultMocks()
    const mockRefetch = vi.fn()
    mockUseHealth.mockReturnValue({
      data: mockHealthData.healthy,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      dataUpdatedAt: Date.now(),
    })

    renderDashboard()

    // Dashboard should be rendered
    expect(screen.getByText('Healthy')).toBeInTheDocument()

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await userEvent.click(refreshButton)

    // Refetch should be called
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })
})
