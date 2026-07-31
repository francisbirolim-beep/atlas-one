import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#182444',
          navyDark: '#0F1830',
          navyLight: '#E7E9F2',
          teal: '#318F81',
          tealDark: '#256B60',
          tealLight: '#E3F3F0',
        },
      },
    },
  },
  plugins: []
}
export default config
