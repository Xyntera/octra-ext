/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/popup/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#030712',
        },
      },
    },
  },
  plugins: [],
};
