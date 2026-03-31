/** @type {import('tailwindcss').Config} */
export default {
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
        sm: '8px',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        lg: '20px',
        xl: '24px',
        '2xl': '28px',
        '3xl': '32px',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
