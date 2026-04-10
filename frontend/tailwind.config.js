/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        canvas:  '#0d1117',
        default: '#161b22',
        subtle:  '#21262d',
        overlay: '#1c2128',
        border:  '#30363d',
        green: { DEFAULT: '#3fb950', dark: '#238636' },
        fg:    { default: '#e6edf3', muted: '#8b949e', subtle: '#6e7681' },
      },
    },
  },
  plugins: [],
}
