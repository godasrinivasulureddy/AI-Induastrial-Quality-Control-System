
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          950: "#09090b",
          900: "#111113",
          850: "#17171a",
          800: "#202024",
          700: "#2f3037"
        }
      },
      boxShadow: {
        "soft-glow": "0 0 0 1px rgba(255,255,255,0.08), 0 18px 50px rgba(0,0,0,0.35)"
      }
    },
  },
  plugins: [animate],
}
