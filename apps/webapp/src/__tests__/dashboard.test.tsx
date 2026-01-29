import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient, mockHealthData, mockConfigData } from './setup'

// Mock the queries module
vi.mock('../lib/queries', () => ({
  useHealth: vi.fn(),
  useConfig: vi.fn(),
}))

// Import after mocking
import { useHealth, useConfig } from '../lib/queries'
// Import the Route to get the component
import { Route } from '../routes/index'

const mockUseHealth = useHealth as ReturnType<typeof vi.fn>
const mockUseConfig = useConfig as ReturnType<typeof vi.fn>

// Get the component from the Route
const DashboardPage = Route.options.component!

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
    mockUseHealth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    })
    mockUseConfig.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    renderDashboard()

    // Should show loading state
    expect(screen.getByText(/loading system status/i)).toBeInTheDocument()
  })

  it('displays health data when loaded', async () => {
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

    renderDashboard()

    // Should show healthy status
    expect(screen.getByText('Healthy')).toBeInTheDocument()

    // Should show connected status for Paperless
    expect(screen.getByText('Connected')).toBeInTheDocument()

    // Should show processing tags from config
    expect(screen.getByText('receipt')).toBeInTheDocument()
    expect(screen.getByText('ai-processed')).toBeInTheDocument()
    expect(screen.getByText('ai-failed')).toBeInTheDocument()
  })

  it('shows error state on API failure', async () => {
    mockUseHealth.mockReturnValue({
      data: mockHealthData.unhealthy,
      isLoading: false,
      isError: true,
      error: new Error('API error'),
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
    })
    mockUseConfig.mockReturnValue({
      data: mockConfigData.default,
      isLoading: false,
    })

    renderDashboard()

    // Should show unhealthy status
    expect(screen.getByText('Unhealthy')).toBeInTheDocument()

    // Should show error messages
    expect(screen.getByText(/Paperless connection failed/i)).toBeInTheDocument()
    expect(screen.getByText(/Together AI key invalid/i)).toBeInTheDocument()
  })

  it('refresh button triggers refetch', async () => {
    const mockRefetch = vi.fn()
    mockUseHealth.mockReturnValue({
      data: mockHealthData.healthy,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      dataUpdatedAt: Date.now(),
    })
    mockUseConfig.mockReturnValue({
      data: mockConfigData.default,
      isLoading: false,
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
