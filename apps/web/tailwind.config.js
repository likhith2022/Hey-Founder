/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#000000",
        panel: "#0A0A0A",
        line: "#1A1A1A",
        accent: "#FFFFFF"
      }
    }
  },
  plugins: []
};
