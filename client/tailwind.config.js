/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Aharoni', '"Aharoni Bold"', '"Secular One"', 'Rubik', 'sans-serif'],
        sans: ['Rubik', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#1e1b4b',
        sun: '#FFD23F',
        bubble: '#FF5D8F',
        mint: '#2EC4B6',
        sky: '#3A86FF',
        grape: '#7B2FF7',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '80%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        rise: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        wiggle: { '0%,100%': { transform: 'rotate(-4deg)' }, '50%': { transform: 'rotate(4deg)' } },
        flip: { '0%': { transform: 'rotateX(90deg)' }, '100%': { transform: 'rotateX(0)' } },
      },
      animation: {
        pop: 'pop .35s ease-out both',
        rise: 'rise .4s ease-out both',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
        flip: 'flip .4s ease-out both',
      },
    },
  },
  plugins: [],
};
