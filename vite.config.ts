import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({root:'web',plugins:[react(),tailwindcss()],resolve:{alias:{'@':new URL('./web/src',import.meta.url).pathname}},server:{proxy:{'/api':'http://127.0.0.1:3100'}},build:{outDir:'../dist',emptyOutDir:true}});
