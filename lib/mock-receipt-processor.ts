export interface ProcessedReceipt {
  id: string
  fileName: string
  date: string
  vendor: string
  category: string
  paymentMethod: string
  taxAmount: number
  amount: number
  thumbnail: string
}

export interface SpendingBreakdown {
  totalSpending: number
  totalReceipts: number
  categories: {
    name: string
    amount: number
    percentage: number
  }[]
}

// Mock receipt processing function that simulates AI extraction
export async function processReceiptImages(files: File[]): Promise<{
  receipts: ProcessedReceipt[]
  breakdown: SpendingBreakdown
}> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Mock data templates for different receipt types
  const mockReceiptTemplates = [
    {
      vendor: "Walmart",
      category: "Groceries",
      paymentMethod: "Credit Card",
      baseAmount: 47.0,
      taxRate: 0.0875,
    },
    {
      vendor: "Target",
      category: "Groceries",
      paymentMethod: "Debit Card",
      baseAmount: 85.0,
      taxRate: 0.05,
    },
    {
      vendor: "Red Lobster",
      category: "Dining",
      paymentMethod: "N/A",
      baseAmount: 34.0,
      taxRate: 0.15,
    },
    {
      vendor: "AT&T",
      category: "Utilities",
      paymentMethod: "Credit Card",
      baseAmount: 67.0,
      taxRate: 0.037,
    },
    {
      vendor: "Amazon",
      category: "Shopping",
      paymentMethod: "Credit Card",
      baseAmount: 29.99,
      taxRate: 0.08,
    },
    {
      vendor: "Netflix",
      category: "Subscriptions",
      paymentMethod: "Credit Card",
      baseAmount: 15.99,
      taxRate: 0,
    },
    {
      vendor: "Uber",
      category: "Transportation",
      paymentMethod: "Credit Card",
      baseAmount: 18.5,
      taxRate: 0.12,
    },
  ]

  // Generate processed receipts from uploaded files
  const processedReceipts: ProcessedReceipt[] = files.map((file, index) => {
    const template = mockReceiptTemplates[index % mockReceiptTemplates.length]
    const amount = template.baseAmount + (Math.random() * 20 - 10) // Add some variation
    const taxAmount = amount * template.taxRate

    // Generate random date within last 30 days
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(Math.random() * 30))

    return {
      id: Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      vendor: template.vendor,
      category: template.category,
      paymentMethod: template.paymentMethod,
      taxAmount: Math.round(taxAmount * 100) / 100,
      amount: Math.round(amount * 100) / 100,
      thumbnail: URL.createObjectURL(file), // Create thumbnail from uploaded file
    }
  })

  // Calculate spending breakdown
  const categoryTotals = processedReceipts.reduce(
    (acc, receipt) => {
      acc[receipt.category] = (acc[receipt.category] || 0) + receipt.amount
      return acc
    },
    {} as Record<string, number>,
  )

  const totalSpending = processedReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)

  const categories = Object.entries(categoryTotals)
    .map(([name, amount]) => ({
      name,
      amount: Math.round(amount * 100) / 100,
      percentage: Math.round((amount / totalSpending) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)

  const breakdown: SpendingBreakdown = {
    totalSpending: Math.round(totalSpending * 100) / 100,
    totalReceipts: processedReceipts.length,
    categories,
  }

  return { receipts: processedReceipts, breakdown }
}
