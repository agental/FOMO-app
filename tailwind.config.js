/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF9F43',
          600: '#FF7E1D',
          700: '#EA580C',
          800: '#C2410C',
          900: '#7C2D12',
        },
        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FFD60A',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        /* ── Semantic layer (mirrors the CSS tokens in index.css) ── */
        primary: {
          DEFAULT: '#F97316',
          dark:    '#EA580C',
          darker:  '#C2410C',
          tint:    '#FFF7ED',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          app:     '#F8FAFB',
          dark:    '#0C0C10',
        },
        content: {
          DEFAULT:   '#0A122A',
          heading:   '#111827',
          secondary: '#374151',
          muted:     '#6B7280',
        },
        success: '#10B981',
        danger:  '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        heading: ['Heebo', 'sans-serif'],
        body: ['Rubik', 'Heebo', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
