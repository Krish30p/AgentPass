/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0F172A",
        cardBg: "#1E293B",
        accentBlue: "#3B82F6",
        accentEmerald: "#10B981",
        accentRose: "#F43F5E",
        accentAmber: "#F59E0B",
      }
    },
  },
  plugins: [],
}
