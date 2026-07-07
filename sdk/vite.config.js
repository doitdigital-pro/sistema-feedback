import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/main.js',
      name: 'IMGCFeedback',
      formats: ['iife'],
      fileName: () => 'imgc-feedback.min.js'
    },
    // Queremos empaquetar html2canvas dentro del mismo archivo para que el cliente no tenga que instalarlo
    rollupOptions: {
      external: [], 
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Por ahora dejaremos los logs para debuggear
      }
    }
  }
});
