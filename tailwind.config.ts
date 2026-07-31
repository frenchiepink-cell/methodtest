import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0F",
        card: "#16161C",
        edge: "#26262F",
        accent: "#6366F1",
      },
    },
  },
  plugins: [],
} satisfies Config;
