/** Configure scans and the CSS-only writing-preview float. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: { float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } },
      animation: { float: 'float 5s ease-in-out infinite' },
      fontFamily: { display: ['Georgia', 'serif'], sans: ['Arial', 'Helvetica', 'sans-serif'] },
    },
  },
  plugins: [],
};
