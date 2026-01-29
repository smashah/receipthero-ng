import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient, mockConfigData } from './setup'

// Mock the queries module
vi.mock('../lib/queries', () => ({
  useConfig: vi.fn(),
  useSaveConfig: vi.fn(),
  useTestPaperless: vi.fn(),
  useTestTogether: vi.fn(),
}))

// Import after mocking
import { useConfig, useSaveConfig, useTestPaperless, useTestTogether } from '../lib/queries'
import { toast } from 'sonner'
// Import the Route to get the component
import { Route } from '../routes/settings'

const mockUseConfig = useConfig as ReturnType<typeof vi.fn>
const mockUseSaveConfig = useSaveConfig as ReturnType<typeof vi.fn>
const mockUseTestPaperless = useTestPaperless as ReturnType<typeof vi.fn>
const mockUseTestTogether = useTestTogether as ReturnType<typeof vi.fn>

// Get the component from the Route
const SettingsPage = Route.options.component!

function setupDefaultMocks() {
  mockUseConfig.mockReturnValue({
    data: mockConfigData.default,
    isLoading: false,
  })
  mockUseSaveConfig.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  })
  mockUseTestPaperless.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ success: true, message: 'Connected!' }),
    isPending: false,
  })
  mockUseTestTogether.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ success: true, message: 'Key valid!' }),
    isPending: false,
  })
}

function renderSettings() {
  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  )
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form fields', async () => {
    setupDefaultMocks()
    renderSettings()

    // Check main heading
    expect(screen.getByRole('heading', { name: /configuration/i })).toBeInTheDocument()

    // Paperless fields
    expect(screen.getByLabelText(/host url/i)).toBeInTheDocument()

    // Together AI section
    expect(screen.getByRole('heading', { name: /together ai/i })).toBeInTheDocument()

    // Processing fields
    expect(screen.getByLabelText(/scan interval/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max retries/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/receipt tag/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/processed tag/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/failed tag/i)).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields', async () => {
    mockUseConfig.mockReturnValue({
      data: {
        ...mockConfigData.default,
        paperless: { host: '', apiKey: '' },
        togetherAi: { apiKey: '' },
      },
      isLoading: false,
    })
    mockUseSaveConfig.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    mockUseTestPaperless.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    mockUseTestTogether.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })

    renderSettings()

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save configuration/i })
    await userEvent.click(saveButton)

    // Should show validation error via toast
    expect(toast.error).toHaveBeenCalledWith('Paperless Host is required')
  })

  it('connection test button triggers mutation', async () => {
    const mockMutate = vi.fn().mockResolvedValue({ success: true, message: 'Connected!' })
    mockUseConfig.mockReturnValue({
      data: mockConfigData.default,
      isLoading: false,
    })
    mockUseSaveConfig.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    mockUseTestPaperless.mockReturnValue({
      mutateAsync: mockMutate,
      isPending: false,
    })
    mockUseTestTogether.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })

    renderSettings()

    // Click Test Connection button
    const testButton = screen.getByRole('button', { name: /test connection/i })
    await userEvent.click(testButton)

    // Mutation should be called
    expect(mockMutate).toHaveBeenCalledTimes(1)
    
    // Should show success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Connected!')
    })
  })

  it('save button submits form data', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    mockUseConfig.mockReturnValue({
      data: {
        ...mockConfigData.default,
        paperless: { host: 'http://localhost:8000', apiKey: 'real-key' },
        togetherAi: { apiKey: 'real-together-key' },
      },
      isLoading: false,
    })
    mockUseSaveConfig.mockReturnValue({
      mutateAsync: mockSave,
      isPending: false,
    })
    mockUseTestPaperless.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    mockUseTestTogether.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })

    renderSettings()

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save configuration/i })
    await userEvent.click(saveButton)

    // Save mutation should be called
    expect(mockSave).toHaveBeenCalledTimes(1)
    
    // Should show success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Configuration saved successfully!')
    })
  })

  it('masked values detected and omitted from save payload', async () => {
    const mockSave = vi.fn().mockResolvedValue({ success: true })
    mockUseConfig.mockReturnValue({
      data: {
        ...mockConfigData.default,
        paperless: { host: 'http://localhost:8000', apiKey: '***masked***' },
        togetherAi: { apiKey: '...hidden...' },
      },
      isLoading: false,
    })
    mockUseSaveConfig.mockReturnValue({
      mutateAsync: mockSave,
      isPending: false,
    })
    mockUseTestPaperless.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    mockUseTestTogether.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })

    renderSettings()

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save configuration/i })
    await userEvent.click(saveButton)

    // Save mutation should be called
    expect(mockSave).toHaveBeenCalledTimes(1)

    // Check that masked values are omitted from payload
    const payload = mockSave.mock.calls[0][0]
    expect(payload.paperless.apiKey).toBeUndefined()
    expect(payload.togetherAi.apiKey).toBeUndefined()
  })
})
