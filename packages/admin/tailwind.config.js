/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#409eff',
      },
    },
  },
  // 避免与 Element Plus 样式冲突
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
