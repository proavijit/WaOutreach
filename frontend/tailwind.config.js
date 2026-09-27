/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wa: {
          dark: '#0b141a',
          panel: '#111b21',
          card: '#182229',
          border: '#222e35',
          accent: '#00a884',
          accentHover: '#06cf9c',
          chatBg: '#0c1317',
          incoming: '#202c33',
          outgoing: '#005c4b',
          muted: '#8696a0',
          light: '#e9edef',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 25px -5px rgba(0, 168, 132, 0.4)',
        'glow-red': '0 0 25px -5px rgba(239, 68, 68, 0.4)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.4)',
      },
    },
  },
  plugins: [],
}
