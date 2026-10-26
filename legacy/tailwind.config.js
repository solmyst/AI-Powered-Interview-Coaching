/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: 'var(--color-void)',
        carbon: 'var(--color-carbon)',
        ash: 'var(--color-ash)',
        mist: 'var(--color-mist)',
        vellum: 'var(--color-vellum)',
        parchment: 'var(--color-parchment)',
        clay: {
          DEFAULT: 'var(--color-clay)',
          pale: 'var(--color-clay-pale)',
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
