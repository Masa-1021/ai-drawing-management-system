/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 三菱電機ブランドカラー
        'me-red': '#FF0000',
        'me-grey': {
          light: '#F2F2F2',
          medium: '#C4C4C4',
          dark: '#333333',
          deep: '#111111',
        },
        'me-blue': '#2A60AD',
        'me-steel-blue': '#496781',
        // PrimaryはME Redを使用
        primary: {
          DEFAULT: '#FF0000',
          50: '#FFE5E5',
          100: '#FFCCCC',
          200: '#FF9999',
          300: '#FF6666',
          400: '#FF3333',
          500: '#FF0000',
          600: '#CC0000',
          700: '#990000',
          800: '#660000',
          900: '#330000',
        },
      },
      borderRadius: {
        'me': '2px',
      },
      boxShadow: {
        'me-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
