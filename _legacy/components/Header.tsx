"use client";

import { GITHUB_LINK } from "@/lib/constant";
import { Star } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-between p-6">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3 justify-center">
          <img src="/icon.svg" className="w-6 h-6" alt="Icon" />
          <img
            src="/logo.svg"
            className="text-lg font-semibold text-[#101828]"
            width="107"
            height="20"
            alt="Receipt Hero"
          />
        </div>
      </div>
      <a
        href={GITHUB_LINK}
        target="_blank"
        className="flex items-center gap-1.5 px-3.5 py-[7px] rounded bg-white/80 border-[0.7px] border-[#d1d5dc] shadow-sm"
      >
        <Star className="h-3.5 w-3.5 text-[#FFC107] fill-[#FFC107]" />
        <span className="text-sm text-right text-[#1e2939]">
          Star on GitHub
        </span>
      </a>
    </header>
  );
}
