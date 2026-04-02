/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        none: '0',
        sm: '3px',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        lg: '15px',
        xl: '19px',
        '2xl': '23px',
        '3xl': '27px',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
