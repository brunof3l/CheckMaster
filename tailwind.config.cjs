/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}', './src/styles/**/*.css'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0B1324',
          light: '#1A2340'
        },
        cm: {
          bg: '#0B1324',
          primary: '#5b8cff',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#06b6d4'
        }
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out both'
      }
    }
  },
  plugins: []
};