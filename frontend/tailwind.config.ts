import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          subtle: "var(--surface-subtle)",
          elevated: "var(--surface-elevated)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        primary: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
          DEFAULT: "#0f172a",
        },
        stock: {
          ok: {
            bg: "#f0fdf4",
            border: "#bbf7d0",
            text: "#15803d",
            dot: "#22c55e",
          },
          low: {
            bg: "#fffbeb",
            border: "#fde68a",
            text: "#b45309",
            dot: "#f59e0b",
          },
          empty: {
            bg: "#fef2f2",
            border: "#fecdd3",
            text: "#b91c1c",
            dot: "#ef4444",
          },
          inactive: {
            bg: "#f4f4f5",
            border: "#e4e4e7",
            text: "#71717a",
            dot: "#a1a1aa",
          },
        },
        ledger: {
          in: {
            text: "#15803d",
            bg: "#f0fdf4",
            border: "#bbf7d0",
          },
          out: {
            text: "#18181b",
            bg: "#f4f4f5",
            border: "#e4e4e7",
          },
          adjust: {
            text: "#4338ca",
            bg: "#eef2ff",
            border: "#c7d2fe",
          },
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
