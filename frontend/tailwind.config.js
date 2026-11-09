/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy typography scale
        navy: {
          50: "#f3f5fb",
          100: "#e4e8f5",
          200: "#c9d2ea",
          300: "#a0b0d9",
          400: "#7187c1",
          500: "#4f66a9",
          600: "#3c4f8c",
          700: "#324072",
          800: "#1f2a4d",
          900: "#141d38",
          950: "#0b1124",
        },
        // Restrained indigo accent
        accent: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(20, 29, 56, 0.04), 0 1px 3px 0 rgba(20, 29, 56, 0.06)",
        "card-hover": "0 10px 30px -12px rgba(20, 29, 56, 0.18)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [],
};
