import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // server: {
  //   proxy: {
  //     "/classplus": {
  //       target: "https://api.classplusapp.com",
  //       changeOrigin: true,
  //       secure: true,
  //       rewrite: (path) =>
  //         path.replace(/^\/classplus/, ""),
  //     },
  //   },
  // },
})
