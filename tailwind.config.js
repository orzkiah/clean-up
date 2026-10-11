/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        slateSubtle: '#64748b',
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
        }
      },
      fontFamily: {
        sans: [
          'Segoe UI Variable Text',
          'Segoe UI',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
