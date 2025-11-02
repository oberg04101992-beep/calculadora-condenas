import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ⚠️ Cambia el base si tu repo NO se llama "calculadora-condenas"
export default defineConfig({
  plugins: [react()],
  base: "/calculadora-condenas/",
  build: {
    outDir: "dist"
  }
});