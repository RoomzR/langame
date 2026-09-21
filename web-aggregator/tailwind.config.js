/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#050505",
        elevated: "#141416",
        ink: "#FFFFFF",
        dim: "#9A9A9A",
        line: "rgba(255,255,255,0.12)",
        accent: "#2015FF",
        deep: "#120B99",
        coral: "#FF6A3D",
        paper: "#F4F4F2",
        night: "#050505",
        free: "#2015FF",
        busy: "#FF6A3D",
        // legacy aliases used by admin console tabs
        void: "#050505",
        velvet: "#141416",
        fog: "#9A9A9A",
        mute: "#9A9A9A",
        gold: "#2015FF",
        signal: "#2015FF",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "40px",
      },
      transitionTimingFunction: {
        hud: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      boxShadow: {
        glow: "0 12px 40px rgba(32, 21, 255, 0.45)",
        lift: "0 24px 64px rgba(0, 0, 0, 0.5)",
      },
      maxWidth: {
        wrap: "1280px",
      },
    },
  },
  plugins: [],
};
