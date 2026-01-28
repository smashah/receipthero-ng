"use client";

import { TOGETHER_AI_LINK } from "@/lib/constant";

export default function Footer() {
  return (
    <footer className="flex items-center justify-center py-4">
      <a
        href={TOGETHER_AI_LINK}
        target="_blank"
        className="text-center text-sm text-[#555]"
      >
        Powered by{" "}
        <img
          className="inline ml-1"
          src="/together.svg"
          width="69"
          height="15"
        />
      </a>
    </footer>
  );
}
