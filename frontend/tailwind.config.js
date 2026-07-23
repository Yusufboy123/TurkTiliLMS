/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f1',
          100: '#ffe0e1',
          500: '#e52b32',
          600: '#c81d25',
          700: '#a9161c',
          950: '#31080b',
        },
      },
      boxShadow: {
        soft: '0 24px 70px -30px rgba(84, 10, 15, 0.32)',
      },
    },
  },
  plugins: [],
};
