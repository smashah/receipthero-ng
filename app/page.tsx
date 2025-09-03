"use client";

import type React from "react";
import { useState } from "react";
import {
  processReceiptImages,
  type ProcessedReceipt,
  type SpendingBreakdown,
} from "@/lib/mock-receipt-processor";

import UploadReceiptPage from "@/app/components/UploadReceiptPage";
import ResultsPage from "@/app/components/ResultsPage";

export default function HomePage() {
  const [processedReceipts, setProcessedReceipts] = useState<ProcessedReceipt[]>([]);
  const [spendingBreakdown, setSpendingBreakdown] = useState<SpendingBreakdown | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const recalculateBreakdown = (receipts: ProcessedReceipt[]): SpendingBreakdown => {
    const categoryTotals = receipts.reduce((acc, receipt) => {
      acc[receipt.category] = (acc[receipt.category] || 0) + receipt.amount;
      return acc;
    }, {} as Record<string, number>);

    const totalSpending = receipts.reduce(
      (sum, receipt) => sum + receipt.amount,
      0
    );

    const categories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
        percentage: Math.round((amount / totalSpending) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalSpending: Math.round(totalSpending * 100) / 100,
      totalReceipts: receipts.length,
      categories,
    };
  };

  const handleProcessFiles = async (files: File[], receipts: ProcessedReceipt[], base64s: string[]) => {
    setIsProcessing(true);

    try {
      console.log('OCR receipts:', receipts);

      // Use real receipts from OCR, but add missing fields
      const enrichedReceipts = receipts.map((receipt, index) => ({
        ...receipt,
        id: receipt.id || Math.random().toString(36).substring(2, 11),
        fileName: receipt.fileName || files[index]?.name || 'unknown',
        thumbnail: receipt.thumbnail || `data:image/jpeg;base64,${base64s[index]}`,
      }));

      const breakdown = recalculateBreakdown(enrichedReceipts);

      // Store in localStorage
      localStorage.setItem('receipts', JSON.stringify({
        base64s,
        receipts: enrichedReceipts,
        breakdown
      }));

      setProcessedReceipts(enrichedReceipts);
      setSpendingBreakdown(breakdown);
      setShowResults(true);
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddMoreReceipts = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      setIsProcessing(true);

      try {
        const results = await processReceiptImages(Array.from(files));
        const updatedReceipts = [...processedReceipts, ...results.receipts];

        setProcessedReceipts(updatedReceipts);
        setSpendingBreakdown(recalculateBreakdown(updatedReceipts));
      } catch (error) {
        console.error("Processing failed:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    input.click();
  };

  const handleDeleteReceipt = (receiptId: string) => {
    const updatedReceipts = processedReceipts.filter(
      (receipt) => receipt.id !== receiptId
    );
    setProcessedReceipts(updatedReceipts);

    if (updatedReceipts.length === 0) {
      setShowResults(false);
      setSpendingBreakdown(null);
    } else {
      setSpendingBreakdown(recalculateBreakdown(updatedReceipts));
    }
  };

  const handleStartOver = () => {
    setProcessedReceipts([]);
    setSpendingBreakdown(null);
    setShowResults(false);
  };

  if (showResults && spendingBreakdown) {
    return (
      <ResultsPage
        processedReceipts={processedReceipts}
        spendingBreakdown={spendingBreakdown}
        onAddMoreReceipts={handleAddMoreReceipts}
        onDeleteReceipt={handleDeleteReceipt}
        onStartOver={handleStartOver}
        isProcessing={isProcessing}
      />
    );
  }

  return (
    <UploadReceiptPage
      onProcessFiles={handleProcessFiles}
      isProcessing={isProcessing}
    />
  );
}