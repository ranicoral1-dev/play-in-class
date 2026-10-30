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
        azure: '#3A86FF',
        grape: '#7B2FF7',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '80%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        rise: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        wiggle: { '0%,100%': { transform: 'rotate(-4deg)' }, '50%': { transform: 'rotate(4deg)' } },
        flip: { '0%': { transform: 'rotateX(90deg)' }, '100%': { transform: 'rotateX(0)' } },
        count: {
          '0%': { transform: 'scale(2.4) rotate(-12deg)', opacity: 0, filter: 'blur(8px)' },
          '45%': { transform: 'scale(.92) rotate(3deg)', opacity: 1, filter: 'blur(0)' },
          '70%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        'ping-once': { '0%': { transform: 'scale(.85)', opacity: 0.9 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
        float: {
          '0%,100%': { transform: 'translateY(0) rotate(-8deg)', opacity: 0.35 },
          '50%': { transform: 'translateY(-22px) rotate(8deg)', opacity: 0.9 },
        },
        drum: { '0%,100%': { transform: 'translateY(0) rotate(-6deg)' }, '50%': { transform: 'translateY(-14px) rotate(6deg)' } },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-3px) rotate(-1deg)' },
          '75%': { transform: 'translateX(3px) rotate(1deg)' },
        },
        confetti: {
          '0%': { transform: 'translateY(-40px) rotate(0)', opacity: 1 },
          '100%': { transform: 'translateY(420px) rotate(540deg)', opacity: 0 },
        },
      },
      animation: {
        pop: 'pop .35s ease-out both',
        rise: 'rise .4s ease-out both',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
        flip: 'flip .4s ease-out both',
        count: 'count .7s cubic-bezier(.2,.9,.3,1.2) both',
        'ping-once': 'ping-once .9s ease-out both',
        float: 'float 3s ease-in-out infinite',
        drum: 'drum .18s ease-in-out infinite',
        shake: 'shake .25s ease-in-out infinite',
        confetti: 'confetti 2.2s ease-in both',
      },
    },
  },
  plugins: [],
};
