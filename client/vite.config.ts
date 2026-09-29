import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwind()],server:{port:5180,proxy:{'/api':process.env.PREVIEW_API || 'http://127.0.0.1:4000'}},build:{sourcemap:false}});
