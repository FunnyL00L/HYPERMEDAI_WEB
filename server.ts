/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import extract from 'extract-zip';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DatabaseSchema, User, Project, Session } from './src/types';

// State configuration and initialization
const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Helper to resolve current active projects directory
function getProjectsDir(): string {
  const db = loadDb();
  if (db.storageConfig && db.storageConfig.customPath && db.storageConfig.customPath.trim() !== '') {
    const custom = db.storageConfig.customPath.trim();
    // Auto-create on the fly if permitted
    if (!fs.existsSync(custom)) {
      try {
        fs.mkdirSync(custom, { recursive: true });
      } catch (e) {
        console.error('Gagal membuat folder penyimpanan kustom, menggunakan default path.', e);
        return DEFAULT_PROJECTS_DIR;
      }
    }
    return custom;
  }
  return DEFAULT_PROJECTS_DIR;
}

// Ensure directories exist on boot
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const initialDir = getProjectsDir();
if (!fs.existsSync(initialDir)) {
  fs.mkdirSync(initialDir, { recursive: true });
}

// Low-level helper to load DB
function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const freshDb: DatabaseSchema = { users: [], projects: [], sessions: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(freshDb, null, 2), 'utf-8');
    return freshDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(data);
    if (!db) {
      return { users: [], projects: [], sessions: [] };
    }
    if (!Array.isArray(db.users)) db.users = [];
    if (!Array.isArray(db.projects)) db.projects = [];
    if (!Array.isArray(db.sessions)) db.sessions = [];
    return db;
  } catch (err) {
    console.error('Error reading database file, starting fresh', err);
    return { users: [], projects: [], sessions: [] };
  }
}

// Low-level helper to save DB
function saveDb(db: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

// Low-level helper to calculate directory size
function getFolderSize(dirPath: string): number {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getFolderSize(filePath);
      } else {
        size += stats.size;
      }
    }
  } catch (e) {
    // ignore
  }
  return size;
}

// Low-level helper to count total files in a folder recursively
function countFilesRecursive(dirPath: string): number {
  let count = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        count += countFilesRecursive(filePath);
      } else {
        count++;
      }
    }
  } catch (e) {
    // ignore
  }
  return count;
}

// Password cryptography tools (PBKDF2 + dynamic Salt for robust secure hashing)
function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Generate human-friendly, cryptographically robust short unique IDs for project routing
function generateProjectId(): string {
  // Generates IDs like "hyx8767266" (3 letters, 7 digits or similar random alphanumeric sequence)
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  let firstPart = '';
  let secondPart = '';
  for (let i = 0; i < 3; i++) {
    firstPart += chars[crypto.randomInt(0, chars.length)];
  }
  for (let i = 0; i < 7; i++) {
    secondPart += digits[crypto.randomInt(0, digits.length)];
  }
  return firstPart + secondPart;
}

// Cookie parser utility
function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    if (name) {
      list[name] = decodeURIComponent((parts[1] || '').trim());
    }
  });
  return list;
}

// Lazy initializer for the Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY' && key.trim() !== '') {
      geminiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return geminiClient;
}

// Function to recursively delete a directory
function deleteFolderRecursive(folderPath: string) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

// Function to recursively copy a folder
function copyFolderRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Templates for served projects states (Active/Inactive, Password Protected, NotFound)
function getHtmlBaseTemplate(title: string, bodyContent: string): string {
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <!-- Tailwind CSS & Google Fonts -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    body {
      font-family: 'Inter', sans-serif;
    }
    .display-font {
      font-family: 'Space Grotesk', sans-serif;
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6 selection:bg-cyan-500 selection:text-slate-900">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950 to-slate-950 -z-10"></div>
  <div class="w-full max-w-md bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-8 backdrop-blur-md relative overflow-hidden">
    <div class="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl"></div>
    ${bodyContent}
    <div class="mt-8 pt-6 border-t border-slate-800/60 text-center">
      <p class="text-xs text-slate-500">Dihosting oleh <span class="font-semibold text-slate-400">Folder Project Web Server</span></p>
    </div>
  </div>
</body>
</html>`;
}

function renderProjectInactiveTemplate(projectName: string): string {
  return getHtmlBaseTemplate(
    'Projek Dinonaktifkan',
    `<div class="text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </div>
      <h1 class="display-font text-2xl font-bold text-slate-100 tracking-tight mb-2">Projek Diproteksi</h1>
      <p class="text-slate-400 text-sm mb-6 leading-relaxed">
        Projek <span class="text-slate-200 font-medium">${projectName}</span> sedang dinonaktifkan sementara oleh pemiliknya. Silakan hubungi pemilik projek untuk informasi lebih lanjut.
      </p>
      <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 text-left">
        <span class="font-semibold text-slate-200">Status:</span> Non-aktif (Inaktif)
      </div>
    </div>`
  );
}

function renderProjectPasswordTemplate(projectName: string, projectId: string, errorMsg?: string): string {
  const errorAlert = errorMsg 
    ? `<div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5 text-red-400 text-xs text-center">${errorMsg}</div>` 
    : '';
  return getHtmlBaseTemplate(
    'Otorisasi Diperlukan',
    `<div class="text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
      </div>
      <h1 class="display-font text-2xl font-bold text-slate-100 tracking-tight mb-2">Akses Terbatas</h1>
      <p class="text-slate-400 text-sm mb-6">
        Projek <span class="text-slate-200 font-bold">${projectName}</span> dilindungi kata sandi. Masukkan password proyek untuk melanjutkan.
      </p>
      ${errorAlert}
      <form method="POST" action="/p/${projectId}/auth" class="space-y-4">
        <div class="text-left">
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password Projek</label>
          <input 
            type="password" 
            name="password" 
            placeholder="Ketik password projek..." 
            required 
            class="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600"
          />
        </div>
        <button 
          type="submit" 
          class="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold px-4 py-3 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/10 active:scale-[0.98]"
        >
          Buka Akses Projek
        </button>
      </form>
    </div>`
  );
}

function renderProject404Template(projectId: string): string {
  return getHtmlBaseTemplate(
    'Projek Tidak Ditemukan',
    `<div class="text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <h1 class="display-font text-2xl font-bold text-slate-100 tracking-tight mb-2">404 - Projek Kosong</h1>
      <p class="text-slate-400 text-sm mb-6 leading-relaxed">
        Maaf, tidak ada file projek yang terdaftar dengan ID <span class="font-mono text-cyan-400 text-xs px-2 py-0.5 bg-slate-950 border border-slate-800 rounded-full">${projectId}</span> di server kami.
      </p>
      <a 
        href="/" 
        class="inline-block bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-medium px-5 py-2.5 rounded-xl text-xs transition-all active:scale-[0.98]"
      >
        Kembali ke Beranda
      </a>
    </div>`
  );
}

function renderProjectFileNotFoundTemplate(projectName: string, filePath: string): string {
  return getHtmlBaseTemplate(
    'File Tidak Ditemukan',
    `<div class="text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
      </div>
      <h1 class="display-font text-2xl font-bold text-slate-100 tracking-tight mb-2">File Hilang</h1>
      <p class="text-slate-400 text-sm mb-6 leading-relaxed">
        Projek <span class="text-slate-200 font-semibold">${projectName}</span> aktif, namun file pada path <code class="text-rose-400 text-xs bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 select-all break-all">${filePath}</code> tidak ditemukan di dalam folder projek yang diunggah.
      </p>
      <a 
        href="/p/${projectName}/index.html" 
        class="inline-block bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold px-5 py-2.5 rounded-xl text-xs transition-all"
      >
        Coba Buka index.html
      </a>
    </div>`
  );
}

function generateGalleryHtml(projectName: string, projectId: string, projectDir: string): string {
  const files: { path: string, urlPath: string, type: string }[] = [];
  function scan(dir: string, relativeRoot: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue; // skip system
      const fullPath = path.join(dir, entry.name);
      const relativePath = relativeRoot === '' ? entry.name : `${relativeRoot}/${entry.name}`;
      if (entry.isDirectory()) {
         scan(fullPath, relativePath);
      } else {
         const lower = entry.name.toLowerCase();
         let type = 'other';
         if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) type = 'image';
         else if (lower.match(/\.(mp4|webm|ogg)$/)) type = 'video';
         else if (lower.match(/\.(pdf|doc|docx|txt|md|csv|xlsx)$/)) type = 'doc';
         
         files.push({
            path: fullPath,
            urlPath: `/p/${projectId}/${relativePath}`,
            type
         });
      }
    }
  }
  scan(projectDir, '');

  let imagesHtml = '';
  let videosHtml = '';
  let docsHtml = '';

  files.forEach(f => {
    const filename = String(f.urlPath.split('/').pop());
    if (f.type === 'image') {
       imagesHtml += `<div class="p-2 border border-blue-900/40 rounded-xl bg-blue-950/20 overflow-hidden group"><a href="${f.urlPath}" target="_blank"><img src="${f.urlPath}" class="w-full h-32 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300" /></a><p class="text-[10px] text-zinc-400 mt-2 truncate text-center font-mono">${filename}</p></div>`;
    } else if (f.type === 'video') {
       videosHtml += `<div class="p-2 border border-red-900/40 rounded-xl bg-red-950/20"><video controls class="w-full h-32 rounded-lg bg-zinc-950"><source src="${f.urlPath}"></video><p class="text-[10px] text-zinc-400 mt-2 truncate text-center font-mono">${filename}</p></div>`;
    } else {
       docsHtml += `<a href="${f.urlPath}" target="_blank" class="p-2 border border-emerald-900/40 rounded-xl bg-emerald-950/20 flex flex-col items-center justify-center text-emerald-400 text-xs hover:bg-emerald-900/30 overflow-hidden break-all text-center h-20 transition-colors font-mono"><svg class="w-5 h-5 mb-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><span class="truncate w-full">${filename}</span></a>`;
    }
  });

  return getHtmlBaseTemplate(
    `Galeri: ${projectName}`,
    `<div>
        <h1 class="display-font text-2xl font-bold tracking-tight mb-2 text-zinc-100">${projectName}</h1>
        <p class="text-[10px] text-zinc-400 font-mono flex gap-2"><span>${files.length} Item</span><span class="text-zinc-600">|</span><span>Mode Galeri (Index Tidak Ditemukan)</span></p>
    </div>
    
    <div class="mt-8 space-y-8 text-left">
      ${imagesHtml ? `<div class="space-y-3"><h2 class="text-xs font-bold text-blue-400 tracking-widest uppercase mb-4 flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Gambar / Foto (${files.filter(f => f.type === 'image').length})</h2><div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">${imagesHtml}</div></div>` : ''}
      
      ${videosHtml ? `<div class="space-y-3"><h2 class="text-xs font-bold text-red-400 tracking-widest uppercase mt-8 mb-4 flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>Video (${files.filter(f => f.type === 'video').length})</h2><div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">${videosHtml}</div></div>` : ''}
      
      ${docsHtml ? `<div class="space-y-3"><h2 class="text-xs font-bold text-emerald-400 tracking-widest uppercase mt-8 mb-4 flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Dokumen & Arbiter (${files.filter(f => f.type === 'doc' || f.type === 'other').length})</h2><div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">${docsHtml}</div></div>` : ''}

      ${(!imagesHtml && !videosHtml && !docsHtml) ? '<div class="text-center py-20 text-zinc-600 border border-zinc-800 rounded-xl bg-zinc-900/20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg><p class="mt-3 text-xs">Folder ini kosong.</p></div>' : ''}
    </div>`
  );
}

function findMainHtmlFile(baseDir: string): string | null {
  if (!fs.existsSync(baseDir)) return null;

  try {
    const items = fs.readdirSync(baseDir);
    
    // 1. Look for index.html (case-insensitive) directly in baseDir
    for (const item of items) {
      if (item.toLowerCase() === 'index.html') {
        const fullPath = path.join(baseDir, item);
        if (fs.statSync(fullPath).isFile()) {
          return fullPath;
        }
      }
    }

    // 2. Look for ANY .html file directly in baseDir
    for (const item of items) {
      if (item.toLowerCase().endsWith('.html')) {
        const fullPath = path.join(baseDir, item);
        if (fs.statSync(fullPath).isFile()) {
          return fullPath;
        }
      }
    }

    // 3. Scan subdirectories recursively for index.html (case-insensitive)
    const subdirectories: string[] = [];
    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === '__MACOSX') continue;
      const fullPath = path.join(baseDir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        subdirectories.push(fullPath);
      }
    }

    // Breed first: scan folders for index.html
    for (const subDir of subdirectories) {
      const found = findMainHtmlFileInFolder(subDir, 'index.html');
      if (found) return found;
    }

    // Scan folders for ANY .html file
    for (const subDir of subdirectories) {
      const found = findMainHtmlFileInFolder(subDir, '.html');
      if (found) return found;
    }
  } catch (e) {
    // Ignore errors
  }

  return null;
}

function findMainHtmlFileInFolder(currentDir: string, searchPattern: 'index.html' | '.html'): string | null {
  try {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      if (fs.statSync(fullPath).isFile()) {
        if (searchPattern === 'index.html' && item.toLowerCase() === 'index.html') {
          return fullPath;
        }
        if (searchPattern === '.html' && item.toLowerCase().endsWith('.html')) {
          return fullPath;
        }
      }
    }

    // Recursive search
    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item === '__MACOSX') continue;
      const fullPath = path.join(currentDir, item);
      if (fs.statSync(fullPath).isDirectory()) {
         const found = findMainHtmlFileInFolder(fullPath, searchPattern);
         if (found) return found;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

function resolveFileWithCompressedVariants(candidatePath: string): { filePath: string; encoding: string | null } | null {
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return { filePath: candidatePath, encoding: null };
  }
  
  // Try .br variant
  const brPath = candidatePath + '.br';
  if (fs.existsSync(brPath) && fs.statSync(brPath).isFile()) {
    return { filePath: brPath, encoding: 'br' };
  }

  // Try .gz variant
  const gzPath = candidatePath + '.gz';
  if (fs.existsSync(gzPath) && fs.statSync(gzPath).isFile()) {
    return { filePath: gzPath, encoding: 'gzip' };
  }

  // Try .unityweb variant
  const unityWebPath = candidatePath + '.unityweb';
  if (fs.existsSync(unityWebPath) && fs.statSync(unityWebPath).isFile()) {
    let encoding: string | null = null;
    try {
      const fd = fs.openSync(unityWebPath, 'r');
      const buffer = Buffer.alloc(2);
      fs.readSync(fd, buffer, 0, 2, 0);
      fs.closeSync(fd);
      if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
        encoding = 'gzip';
      }
    } catch (e) {
      // Ignore errors reading magic bytes
    }
    return { filePath: unityWebPath, encoding };
  }

  return null;
}

async function startServer() {
  const app = express();

  // CORS & Network Interoperability for LAN, Local, and Cross-Device Direct Hosting
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, X-File-Name, X-Project-Id');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support reading JSON input body payload up to 10GB for folder uploading!
  app.use(express.json({ limit: '10000mb' }));
  app.use(express.urlencoded({ limit: '10000mb', extended: true }));

  // API Route - Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Dynamic Content-Type mapper helper
  function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.html': return 'text/html';
      case '.css': return 'text/css';
      case '.js': return 'application/javascript';
      case '.wasm': return 'application/wasm';
      case '.json': return 'application/json';
      case '.png': return 'image/png';
      case '.jpg': case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      case '.svg': return 'image/svg+xml';
      case '.webp': return 'image/webp';
      case '.ico': return 'image/x-icon';
      case '.txt': return 'text/plain';
      case '.md': return 'text/markdown';
      case '.unityweb': return 'application/octet-stream';
      case '.data': return 'application/octet-stream';
      default: return 'application/octet-stream';
    }
  }

  // --- Dynamic Live Project Files Serving Routing ---
  app.all('/p/:projectId*', (req, res, next) => {
    const { projectId } = req.params as any;
    const db = loadDb();
    const projIdx = db.projects.findIndex((p) => p.id === projectId);
    
    if (projIdx === -1) {
      return res.status(404).send(renderProject404Template(projectId));
    }
    
    const proj = db.projects[projIdx];

    if (proj.status === 'inactive') {
      return res.status(403).send(renderProjectInactiveTemplate(proj.name));
    }

    // Increment visitors hits count on HTML or directory index queries
    const requestPathForHits = req.params[0] || '';
    if (requestPathForHits === '' || requestPathForHits === '/' || requestPathForHits.endsWith('.html') || !requestPathForHits.includes('.')) {
      proj.accessCount = (proj.accessCount || 0) + 1;
      proj.lastAccessedAt = new Date().toISOString();
      saveDb(db);
    }

    // Checking project authentication
    if (proj.isProtected) {
      const cookieName = `project_auth_${projectId}`;
      const cookies = parseCookies(req.headers.cookie || '');
      let unlocked = cookies[cookieName] === proj.passwordHash;

      // Handle the password submission endpoint on POST to /p/:projectId/auth
      const requestPath = req.params[0] || '';
      if (req.method === 'POST' && (requestPath === '/auth' || requestPath === 'auth')) {
        const password = req.body?.password || '';
        const hashedInput = hashPassword(password, proj.passwordSalt!);

        if (hashedInput === proj.passwordHash) {
          // Store authentication hash securely inside cookie valid for 1 day
          res.setHeader('Set-Cookie', `${cookieName}=${proj.passwordHash}; Path=/p/${projectId}; Max-Age=86400; HttpOnly`);
          return res.redirect(`/p/${projectId}/`);
        } else {
          return res.status(401).send(renderProjectPasswordTemplate(proj.name, projectId, 'Kata sandi salah. Silakan coba lagi.'));
        }
      }

      if (!unlocked) {
        return res.send(renderProjectPasswordTemplate(proj.name, projectId));
      }
    }

    // Resolve relative path request
    let requestPath = req.params[0] || '';
    if (requestPath === '/' || requestPath === '') {
      requestPath = '/index.html';
    }

    // Path Traversal Security: normalize the relative URL path to block traversal hacks like '..'
    let safePath = path.normalize(requestPath).replace(/^(\.\.[\/\\])+/, '');
    if (safePath.startsWith('/') || safePath.startsWith('\\')) {
      safePath = safePath.substring(1);
    }

    const projectBaseDir = path.join(getProjectsDir(), projectId);

    // 1. Locate the main HTML file in the project directory using our robust helper
    const mainHtmlPath = findMainHtmlFile(projectBaseDir);
    let relativeOffset = '';
    if (mainHtmlPath) {
      relativeOffset = path.relative(projectBaseDir, path.dirname(mainHtmlPath));
    }

    let fileToServe: string | null = null;
    let contentEncoding: string | null = null;
    let originalRequestedFileForType: string = safePath;

    // Check if index.html (or root-level launch) is being requested
    const isMainHtmlRequest = safePath.toLowerCase() === 'index.html';

    if (isMainHtmlRequest) {
      if (mainHtmlPath) {
        fileToServe = mainHtmlPath;
        originalRequestedFileForType = 'index.html';
      } else {
        // The user is requesting root or index, but there's no HTML file.
        // Render a gallery view instead of 404!
        return res.send(generateGalleryHtml(proj.name, proj.id, projectBaseDir));
      }
    }

    // If we haven't selected the main html file to serve, try to resolve asset paths
    if (!fileToServe) {
      // Try Candidate 1: direct from projectBaseDir (preserving URL path exactly)
      const candidate1 = path.join(projectBaseDir, safePath);
      const res1 = resolveFileWithCompressedVariants(candidate1);
      if (res1) {
        fileToServe = res1.filePath;
        contentEncoding = res1.encoding;
      } else if (relativeOffset) {
        // Try Candidate 2: relative to the main index.html offset folder
        const candidate2 = path.join(projectBaseDir, relativeOffset, safePath);
        const res2 = resolveFileWithCompressedVariants(candidate2);
        if (res2) {
          fileToServe = res2.filePath;
          contentEncoding = res2.encoding;
        }
      }

      // SPA Fallback: If not found and it's not a clear static asset (or we just want strict fallback like Nginx try_files $uri /index.html)
      if (!fileToServe) {
         // Emulate try_files $uri $uri/ /index.html
         if (mainHtmlPath) {
           fileToServe = mainHtmlPath;
           originalRequestedFileForType = 'index.html';
         }
      }
    }

    // If we have selected a file, serve it with proper headers and encoding
    if (fileToServe) {
      let contentType = getContentType(originalRequestedFileForType);

      // Extract custom content type based on the physical file extension if needed,
      // or if original is generic while the physical filesystem has the exact suffix
      if (contentType === 'application/octet-stream') {
        contentType = getContentType(fileToServe);
      }

      // If physical file has a compressed extension and encoding was not already set, parse it
      const lowerPhysicalPath = fileToServe.toLowerCase();
      if (!contentEncoding) {
        if (lowerPhysicalPath.endsWith('.br')) {
          contentEncoding = 'br';
        } else if (lowerPhysicalPath.endsWith('.gz')) {
          contentEncoding = 'gzip';
        }
      }

      // Ensure appropriate headers for Unity WebGL
      res.setHeader('Content-Type', contentType);
      if (contentEncoding) {
        res.setHeader('Content-Encoding', contentEncoding);
      }

      // Prevent caching for active development/changes
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.sendFile(fileToServe);
    } else {
      return res.status(404).send(renderProjectFileNotFoundTemplate(proj.name, safePath));
    }
  });

  // --- API Routes: User Authenticaton (Enkripsi Kuat & Database Lokal) ---
  
  // Custom middleware to verify user session via session_token cookie
  function getLoggedInUsername(req: express.Request): string | null {
    // Auth disabled as requested to allow maximum optimal usage without confusion.
    return "admin";
  }

  // GET REGISTRATION STATUS
  app.get('/api/auth/registration-status', (req, res) => {
    const db = loadDb();
    const hasRegisteredUser = db.users.length > 0;
    return res.json({ registrationDisabled: hasRegisteredUser });
  });

  // REGISTER ENDPOINT
  app.post('/api/auth/register', (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Username dan password tidak boleh kosong.' });
      }

      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3 || password.length < 5) {
        return res.status(400).json({ error: 'Username minimal 3 karakter, password minimal 5 karakter.' });
      }

      const db = loadDb();
      const userExists = db.users.some((u) => u.username === cleanUsername);
      if (userExists) {
        return res.status(400).json({ error: 'Username sudah digunakan.' });
      }

      // POLICY: If there's already 1 or more users, registration is disabled unless you are currently logged in!
      const loggedInUser = getLoggedInUsername(req);
      if (db.users.length > 0 && !loggedInUser) {
        return res.status(403).json({ 
          error: 'Registrasi publik dinonaktifkan. Anda harus masuk untuk menambahkan/mendaftarkan administrator baru.' 
        });
      }

      // Cryptography Security: Generate unique salt and hash with PBKDF2 + SHA512
      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);

      const newUser: User = {
        username: cleanUsername,
        passwordHash,
        salt,
        createdAt: new Date().toISOString(),
      };

      db.users.push(newUser);
      saveDb(db);

      return res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
    } catch (err) {
      next(err);
    }
  });

  // RESET PASSWORD (LUPA PASSWORD) ENDPOINT
  app.post('/api/auth/reset-password', (req, res) => {
    const { username, adminPhone, newPassword } = req.body;
    if (!username || !adminPhone || !newPassword) {
      return res.status(400).json({ error: 'Data tidak lengkap. Semua kolom wajib diisi.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (adminPhone !== '082147019988') {
      return res.status(400).json({ error: 'Nomor telepon pemulihan admin salah atau tidak dikenal.' });
    }

    if (newPassword.length < 5) {
      return res.status(400).json({ error: 'Kata sandi baru minimal 5 karakter.' });
    }

    const db = loadDb();
    const userIdx = db.users.findIndex((u) => u.username === cleanUsername);
    if (userIdx === -1) {
      return res.status(404).json({ error: 'Username administrator tidak terdaftar.' });
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(newPassword, salt);
    db.users[userIdx].salt = salt;
    db.users[userIdx].passwordHash = passwordHash;
    saveDb(db);

    return res.json({ success: true, message: 'Kata sandi baru berhasil disetel ulang secara aman.' });
  });

  // GET DISK STORAGE METRICS ROUTE
  app.get('/api/system/storage', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi tidak sah.' });
    }
    const totalBytes = getFolderSize(getProjectsDir());
    
    // Formatting helper
    let formattedUsed = '';
    if (totalBytes < 1024) {
      formattedUsed = `${totalBytes} B`;
    } else if (totalBytes < 1024 * 1024) {
      formattedUsed = `${(totalBytes / 1024).toFixed(2)} KB`;
    } else if (totalBytes < 1024 * 1024 * 1024) {
      formattedUsed = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      formattedUsed = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    const db = loadDb();
    const projectsCount = db.projects.length;

    return res.json({
      totalBytes,
      isUnlimited: true,
      formattedUsed,
      formattedLimit: 'Tanpa Batas ♾️',
      projectsCount
    });
  });

  // GET SYSTEM STORAGE AND CUSTOM MONITOR DIAGNOSTICS
  app.get('/api/system/storage-settings', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi tidak sah. Silakan login kembali.' });
    }

    const db = loadDb();
    const currentActivePath = getProjectsDir();
    
    // Scan active folder for subprojects & files count / sizes dynamically
    const detailedProjectsMetrics: any[] = [];
    db.projects.forEach(p => {
      const pFolder = path.join(currentActivePath, p.id);
      let pSize = 0;
      let pExists = false;
      if (fs.existsSync(pFolder)) {
        pExists = true;
        pSize = getFolderSize(pFolder);
      }
      detailedProjectsMetrics.push({
        id: p.id,
        name: p.name,
        exists: pExists,
        sizeInBytes: pSize,
        filesCount: p.filesCount,
        status: p.status,
        createdAt: p.createdAt
      });
    });

    // Check if path is writable on-the-fly
    let pathWritable = false;
    try {
      const testFile = path.join(currentActivePath, '.write_test_token');
      fs.writeFileSync(testFile, 'OK', 'utf-8');
      fs.unlinkSync(testFile);
      pathWritable = true;
    } catch (e) {
      // Not writable
    }

    // Capture OS detailed systems metadata
    const systemDiagnostics = {
      osType: os.type(),
      osPlatform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      cpuModel: os.cpus()[0]?.model || 'Generic CPU',
      cpuCount: os.cpus().length,
      loadAvg: os.loadavg(),
      processUptime: process.uptime(),
      hostname: os.hostname(),
    };

    return res.json({
      defaultPath: DEFAULT_PROJECTS_DIR,
      customPath: db.storageConfig?.customPath || '',
      currentActivePath,
      pathWritable,
      detailedProjectsMetrics,
      systemDiagnostics,
    });
  });

  // POST SYSTEM STORAGE SETTINGS - SET CUSTOM STORAGE LOCATION
  app.post('/api/system/storage-settings', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi tidak sah. Silakan login kembali.' });
    }

    const { customPath } = req.body;
    if (typeof customPath !== 'string') {
      return res.status(400).json({ error: 'Format path tidak valid.' });
    }

    const targetPath = customPath.trim();
    const db = loadDb();
    const oldPath = getProjectsDir();

    let resolvedPath = DEFAULT_PROJECTS_DIR;
    if (targetPath !== '') {
      resolvedPath = path.resolve(targetPath);
    }

    // Try to normalize and check if it's writable
    try {
      if (!fs.existsSync(resolvedPath)) {
        fs.mkdirSync(resolvedPath, { recursive: true });
      }
      const testFile = path.join(resolvedPath, '.write_test_token');
      fs.writeFileSync(testFile, 'OK', 'utf-8');
      fs.unlinkSync(testFile);
    } catch (err: any) {
      return res.status(400).json({ error: `Gagal mengalihkan ke path baru. Folder tidak dapat ditulis atau hak akses ditolak: ${err.message}` });
    }

    // Perform data migration from oldPath to resolvedPath
    let migratedCount = 0;
    try {
      if (fs.existsSync(oldPath) && oldPath !== resolvedPath) {
        db.projects.forEach((proj) => {
          const oldFolder = path.join(oldPath, proj.id);
          const newFolder = path.join(resolvedPath, proj.id);
          if (fs.existsSync(oldFolder) && !fs.existsSync(newFolder)) {
            copyFolderRecursive(oldFolder, newFolder);
            migratedCount++;
          }
        });
      }
    } catch (migErr) {
      console.error("Gagal melakukan migrasi projek", migErr);
    }

    if (targetPath === '') {
      if (db.storageConfig) {
        delete db.storageConfig;
      }
    } else {
      db.storageConfig = { customPath: resolvedPath };
    }
    saveDb(db);

    return res.json({
      success: true,
      message: `Sukses! Jalur penyimpanan projek dialihkan ke: ${resolvedPath}. Berhasil memindahkan ${migratedCount} folder projek ke lokasi baru secara aman.`,
      currentPath: resolvedPath,
      migratedCount
    });
  });

  // LOGIN ENDPOINT
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = loadDb();
    const user = db.users.find((u) => u.username === cleanUsername);

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    // Verify hashed password
    const loginHash = hashPassword(password, user.salt);
    if (loginHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    // Generate secure session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 Days

    const newSession: Session = {
      id: sessionId,
      username: cleanUsername,
      expiresAt,
    };

    db.sessions.push(newSession);
    saveDb(db);

    // Set secure HTTPOnlycookie
    res.setHeader('Set-Cookie', `session_token=${sessionId}; Path=/; HttpOnly; Max-Age=${14 * 24 * 60 * 60}; SameSite=Strict`);
    return res.json({ success: true, username: cleanUsername });
  });

  // LOGOUT ENDPOINT
  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.session_token;
    
    if (token) {
      const db = loadDb();
      db.sessions = db.sessions.filter((s) => s.id !== token);
      saveDb(db);
    }

    res.setHeader('Set-Cookie', 'session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly');
    return res.json({ success: true });
  });

  // GET AUTH STATUS
  app.get('/api/auth/me', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ authenticated: false });
    }
    return res.json({ authenticated: true, username });
  });


  // --- API Routes: Project Hosting & Directories Management ---

  // LIST USER'S PROJECTS
  app.get('/api/projects', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
    }

    const db = loadDb();
    const userProjects = db.projects;
    return res.json({ projects: userProjects });
  });

  // LIST INDIVIDUAL PROJECT FILES FOR PHYSICAL STORAGE MANAGEMENT & MONITORING
  app.get('/api/projects/:projectId/files', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
    }

    const { projectId } = req.params;
    const db = loadDb();
    const proj = db.projects.find((p) => p.id === projectId);

    if (!proj) {
      return res.status(404).json({ error: 'Projek tidak ditemukan.' });
    }

    const projectFolder = path.join(getProjectsDir(), projectId);
    if (!fs.existsSync(projectFolder)) {
      return res.status(404).json({ error: 'Folder fisik projek hilang di server.' });
    }

    // Recursive files explorer
    function scanDir(dir: string, baseDir: string): any[] {
      let filesList: any[] = [];
      if (!fs.existsSync(dir)) return filesList;
      
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        
        if (item.isDirectory()) {
          filesList.push({
            name: item.name,
            path: relativePath,
            isDirectory: true,
            size: 0,
            formattedSize: '-'
          });
          filesList = filesList.concat(scanDir(fullPath, baseDir));
        } else {
          try {
            const stats = fs.statSync(fullPath);
            let formattedSize = '';
            if (stats.size < 1024) {
              formattedSize = `${stats.size} B`;
            } else if (stats.size < 1024 * 1024) {
              formattedSize = `${(stats.size / 1024).toFixed(1)} KB`;
            } else {
              formattedSize = `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
            }

            filesList.push({
              name: item.name,
              path: relativePath,
              isDirectory: false,
              size: stats.size,
              formattedSize,
              type: path.extname(item.name).toLowerCase(),
              lastModified: stats.mtime
            });
          } catch {
            // handle error
          }
        }
      }
      return filesList;
    }

    try {
      const files = scanDir(projectFolder, projectFolder);
      return res.json({ files });
    } catch (err: any) {
      return res.status(500).json({ error: `Gagal membaca isi berkas projek: ${err.message}` });
    }
  });

  app.post('/api/projects/init', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) return res.status(401).json({ error: 'Sesi kedaluwarsa.' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nama projek tidak valid.' });
    const cleanProjectName = name.replace(/[^\w\s-]/gi, '').trim();
    if (!cleanProjectName) return res.status(400).json({ error: 'Nama folder tidak valid.' });

    const projectId = generateProjectId();
    const projectFolder = path.join(getProjectsDir(), projectId);
    try { fs.mkdirSync(projectFolder, { recursive: true }); } catch (err) {}
    
    return res.json({ success: true, projectId, name: cleanProjectName });
  });

  app.post('/api/projects/:projectId/chunk', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) return res.status(401).json({ error: 'Sesi kedaluwarsa.' });
    const { projectId } = req.params;
    const { files } = req.body;
    
    const projectFolder = path.join(getProjectsDir(), projectId);
    if (!fs.existsSync(projectFolder)) return res.status(404).json({ error: 'Folder projek tidak ditemukan.' });
    
    try {
      for (const file of files) {
        if (!file || !file.path) continue;
        const safeFilePath = path.normalize(file.path).replace(/^(\.\.[\/\\])+/, '');
        const targetDiskPath = path.join(projectFolder, safeFilePath);
        const parentDir = path.dirname(targetDiskPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        
        const rawContent = file.content !== undefined && file.content !== null ? file.content : '';
        if (file.isBinary) {
          if (file.append && fs.existsSync(targetDiskPath)) {
            fs.appendFileSync(targetDiskPath, Buffer.from(rawContent, 'base64'));
          } else {
            fs.writeFileSync(targetDiskPath, Buffer.from(rawContent, 'base64'));
          }
        } else {
          if (file.append && fs.existsSync(targetDiskPath)) {
            fs.appendFileSync(targetDiskPath, rawContent, 'utf-8');
          } else {
            fs.writeFileSync(targetDiskPath, rawContent, 'utf-8');
          }
        }
      }
      return res.json({ success: true });
    } catch(err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/projects/:projectId/cleanup', (req, res) => {
    const { projectId } = req.params;
    const projectFolder = path.join(getProjectsDir(), projectId);
    
    try {
      if (fs.existsSync(projectFolder)) {
        deleteFolderRecursive(projectFolder);
      }
      
      // Also ensure it is removed from db if it was registered
      const db = loadDb();
      const idx = db.projects.findIndex(p => p.id === projectId);
      if (idx !== -1) {
        db.projects.splice(idx, 1);
        saveDb(db);
      }
      
      return res.json({ success: true, message: 'Projek yang belum selesai atau gagal berhasil dibersihkan.' });
    } catch (err: any) {
      return res.status(500).json({ error: `Gagal membersihkan projek: ${err.message}` });
    }
  });

  app.post('/api/projects/:projectId/update-init', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
    const { projectId } = req.params;
    
    const db = loadDb();
    const project = db.projects.find(p => p.id === projectId);
    if (!project) return res.status(404).json({ error: 'Projek tidak ditemukan.' });

    const projectFolder = path.join(getProjectsDir(), projectId);
    try {
      if (fs.existsSync(projectFolder)) {
        // Clear old files inside project folder to prepare for new upload
        const files = fs.readdirSync(projectFolder);
        for (const file of files) {
          const curPath = path.join(projectFolder, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteFolderRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        }
      } else {
        fs.mkdirSync(projectFolder, { recursive: true });
      }
      return res.json({ success: true, projectId, name: project.name });
    } catch (err: any) {
      return res.status(500).json({ error: `Gagal mempersiapkan pembaruan projek: ${err.message}` });
    }
  });

  app.post('/api/projects/:projectId/raw-chunk', express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req, res) => {
    const { projectId } = req.params;
    const rawFilePath = (req.query.filePath as string) || (req.query.fileName as string) || 'upload.zip';
    const append = req.query.append === 'true';
    
    const projectFolder = path.join(getProjectsDir(), projectId);
    if (!fs.existsSync(projectFolder)) {
      try { fs.mkdirSync(projectFolder, { recursive: true }); } catch (e) {}
    }
    
    try {
      const safeRelativePath = path.normalize(rawFilePath).replace(/^(\.\.[\/\\])+/, '');
      const targetDiskPath = path.join(projectFolder, safeRelativePath);
      const parentDir = path.dirname(targetDiskPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (append && fs.existsSync(targetDiskPath)) {
        fs.appendFileSync(targetDiskPath, req.body);
      } else {
        fs.writeFileSync(targetDiskPath, req.body);
      }
      return res.json({ success: true });
    } catch(err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/projects/:projectId/zip-extract', async (req, res) => {
    const { projectId } = req.params;
    const fileName = req.query.fileName as string || 'upload.zip';
    const projectFolder = path.join(getProjectsDir(), projectId);
    const zipPath = path.join(projectFolder, fileName);

    if (!fs.existsSync(zipPath)) return res.status(404).json({ error: 'File ZIP tidak ditemukan.' });

    try {
      // Extract ZIP
      await extract(zipPath, { dir: projectFolder });
      
      // Delete ZIP after extraction
      try { fs.unlinkSync(zipPath); } catch (e) {}

      // Recursive function to find innermost folder containing index.html
      const findRootFolder = (dir: string): string | null => {
         const items = fs.readdirSync(dir);
         if (items.includes('index.html')) return dir;
         
         for (const item of items) {
           const fullPath = path.join(dir, item);
           if (fs.statSync(fullPath).isDirectory()) {
             const result = findRootFolder(fullPath);
             if (result) return result;
           }
         }
         return null;
      };

      const rootFolder = findRootFolder(projectFolder);
      if (rootFolder && rootFolder !== projectFolder) {
         // Move contents of rootFolder to projectFolder
         const items = fs.readdirSync(rootFolder);
         for (const item of items) {
            fs.renameSync(path.join(rootFolder, item), path.join(projectFolder, item));
         }
      }

      // Count files
      const totalExtracted = countFilesRecursive(projectFolder);
      
      // We don't finalize the DB record here; the frontend will call /finalize or /update-finalize
      return res.json({ success: true, totalExtracted });
    } catch(err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/projects/:projectId/update-finalize', async (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) return res.status(401).json({ error: 'Sesi kedaluwarsa.' });
    const { projectId } = req.params;
    const { name, totalFiles, sampleContent, sampleFileName } = req.body;

    const db = loadDb();
    const projIdx = db.projects.findIndex(p => p.id === projectId);
    if (projIdx === -1) return res.status(404).json({ error: 'Projek tidak ditemukan.' });

    const project = db.projects[projIdx];
    if (name && typeof name === 'string' && name.trim()) {
      project.name = name.trim();
    }

    const projectFolder = path.join(getProjectsDir(), projectId);
    let realTotalFiles = totalFiles;
    if (!realTotalFiles && fs.existsSync(projectFolder)) {
      realTotalFiles = countFilesRecursive(projectFolder);
    }
    project.filesCount = realTotalFiles || 0;
    project.lastAccessedAt = new Date().toISOString();

    const gemini = getGeminiClient();
    if (gemini && sampleContent) {
      try {
        let safeSample = sampleContent;
        if (safeSample.length > 500) {
          safeSample = safeSample.substring(0, 500) + '... [truncated]';
        }

        const prompt = `Analisis pembaruan berkas proyek web statis berikut:
Nama Proyek: ${project.name}
Isi Sampel File (${sampleFileName || 'index.html'}): ${safeSample}

Tugas: Buat deskripsi singkat (maksimal 15 kata) yang merangkum tujuan atau fungsi utama proyek ini dalam bahasa Indonesia. Deskripsi tersebut harus sopan, menarik, dan langsung menceritakan apa fungsi proyek itu. Jangan menyebutkan detail JSON, code, atau struktur internal. Tuliskan deskripsinya saja tanpa tanda petik atau metadata tambahan.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
        });

        if (response.text && response.text.trim().length > 0) {
          project.description = response.text.trim();
        }
      } catch (aiErr) {
        console.error('Gemini failed during update', aiErr);
      }
    }

    db.projects[projIdx] = project;
    saveDb(db);

    return res.json({ success: true, project });
  });

  app.post('/api/projects/:projectId/finalize', async (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) return res.status(401).json({ error: 'Sesi kedaluwarsa.' });
    const { projectId } = req.params;
    const { name, totalFiles, sampleContent, sampleFileName } = req.body;

    let briefDescription = 'Projek web statis diunggah secara lokal.';
    const gemini = getGeminiClient();

    if (gemini && sampleContent) {
      try {
        let safeSample = sampleContent;
        if (safeSample.length > 500) {
          safeSample = safeSample.substring(0, 500) + '... [truncated]';
        }

        const prompt = `Analisis stuktur folder proyek web statis berikut:
Nama Proyek: ${name}
Isi Sampel File (${sampleFileName || 'index.html'}): ${safeSample}

Tugas: Buat deskripsi singkat (maksimal 15 kata) yang merangkum tujuan atau fungsi utama proyek ini dalam bahasa Indonesia. Deskripsi tersebut harus sopan, menarik, dan langsung menceritakan apa fungsi proyek itu. Jangan menyebutkan detail JSON, code, atau struktur internal. Tuliskan deskripsinya saja tanpa tanda petik atau metadata tambahan.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
        });

        if (response.text && response.text.trim().length > 0) {
          briefDescription = response.text.trim();
        }
      } catch (aiErr) {
        console.error('Gemini failed', aiErr);
      }
    }

    const db = loadDb();
    const newProject: Project = {
      id: projectId,
      name,
      description: briefDescription,
      ownerUsername: username,
      status: 'active',
      isProtected: false,
      passwordHash: null,
      passwordSalt: null,
      filesCount: totalFiles || 0,
      createdAt: new Date().toISOString(),
    };

    db.projects.push(newProject);
    saveDb(db);

    return res.json({ success: true, project: newProject });
  });

  // FOLDER UPLOAD & AUTO-SUMMARIZATION BY GEMINI API (Legacy Support)
  app.post('/api/projects/upload', async (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
    }

    const { name, files } = req.body;
    if (!name || !files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Input tidak valid. Folder harus memiliki setidaknya satu file.' });
    }

    const cleanProjectName = name.replace(/[^\w\s-]/gi, '').trim();
    if (!cleanProjectName) {
      return res.status(400).json({ error: 'Nama folder tidak valid.' });
    }

    const projectId = generateProjectId();
    const projectFolder = path.join(getProjectsDir(), projectId);

    // Create the project files physically on disk
    try {
      fs.mkdirSync(projectFolder, { recursive: true });

      for (const file of files) {
        if (!file || !file.path) continue;
        // Prevent path traversal outside project directory
        const safeFilePath = path.normalize(file.path).replace(/^(\.\.[\/\\])+/, '');
        const targetDiskPath = path.join(projectFolder, safeFilePath);

        // Ensure parent subdirectories exist
        const parentDir = path.dirname(targetDiskPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        const rawContent = file.content !== undefined && file.content !== null ? file.content : '';

        if (file.isBinary) {
          // Base64 decoding for binary files
          const buffer = Buffer.from(rawContent, 'base64');
          fs.writeFileSync(targetDiskPath, buffer);
        } else {
          // Regular UTF-8 content writing for plain text
          fs.writeFileSync(targetDiskPath, rawContent, 'utf-8');
        }
      }
    } catch (err: any) {
      console.error('Error writing folder files to disk', err);
      return res.status(500).json({ error: `Gagal membuat folder projek di server: ${err.message}` });
    }

    // Gemini AI Auto-Generation of Brief Description
    let briefDescription = 'Projek web statis diunggah secara lokal.';
    const gemini = getGeminiClient();

    if (gemini) {
      try {
        // Find best file for preview summary context, e.g. index.html or README.md
        let sampleContent = '';
        const indexFile = files.find(f => f.path.endsWith('index.html'));
        const readmeFile = files.find(f => f.path.toLowerCase().endsWith('readme.md'));
        
        let sampleFileName = '';
        if (readmeFile) {
          sampleContent = readmeFile.content;
          sampleFileName = readmeFile.path;
        } else if (indexFile) {
          sampleContent = indexFile.content;
          sampleFileName = indexFile.path;
        }

        // Keep content preview small to save prompt tokens
        if (sampleContent.length > 500) {
          sampleContent = sampleContent.substring(0, 500) + '... [truncated]';
        }

        const filePathsList = files.map(f => f.path).join(', ');

        const prompt = `Analisis stuktur folder proyek web statis berikut:
Nama Proyek: ${name}
Daftar File: ${filePathsList}
Isi Sampel File (${sampleFileName}): ${sampleContent}

Tugas: Buat deskripsi singkat (maksimal 15 kata) yang merangkum tujuan atau fungsi utama proyek ini dalam bahasa Indonesia. Deskripsi tersebut harus sopan, menarik, dan langsung menceritakan apa fungsi proyek itu. Jangan menyebutkan detail JSON, code, atau struktur internal. Tuliskan deskripsinya saja tanpa tanda petik atau metadata tambahan.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
        });

        if (response.text && response.text.trim().length > 0) {
          briefDescription = response.text.trim();
        }
      } catch (aiErr) {
        console.error('Gemini failed to generate summary, falling back to default', aiErr);
        // It failed safely, fallback used
      }
    } else {
      console.log('Gemini client not initialized: Missing API key or in placeholders mode.');
    }

    const db = loadDb();
    const newProject: Project = {
      id: projectId,
      name: cleanProjectName,
      description: briefDescription,
      ownerUsername: username,
      status: 'active',
      isProtected: false,
      passwordHash: null,
      passwordSalt: null,
      filesCount: files.length,
      createdAt: new Date().toISOString(),
    };

    db.projects.push(newProject);
    saveDb(db);

    return res.json({ success: true, project: newProject });
  });

  // EDIT PROJECT METADATA & LOCK STATUS
  app.put('/api/projects/:projectId', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
    }

    const { projectId } = req.params;
    const { name, description, status, isProtected, password } = req.body;

    const db = loadDb();
    const index = db.projects.findIndex((p) => p.id === projectId);

    if (index === -1) {
      return res.status(404).json({ error: 'Projek tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    const project = db.projects[index];

    if (name && typeof name === 'string') {
      project.name = name.trim();
    }
    if (description && typeof description === 'string') {
      project.description = description.trim();
    }
    if (status === 'active' || status === 'inactive') {
      project.status = status;
    }

    if (typeof isProtected === 'boolean') {
      project.isProtected = isProtected;
      
      if (isProtected) {
        if (password && typeof password === 'string' && password.trim() !== '') {
          // Encrypt and update the project access password
          const salt = generateSalt();
          const hash = hashPassword(password, salt);
          project.passwordHash = hash;
          project.passwordSalt = salt;
        } else if (!project.passwordHash) {
          return res.status(400).json({ error: 'Kunci sandi wajib diisi jika mengaktifkan enkripsi projek.' });
        }
      } else {
        // Clear old password elements when unprotected
        project.passwordHash = null;
        project.passwordSalt = null;
      }
    }

    db.projects[index] = project;
    saveDb(db);

    return res.json({ success: true, project });
  });

  // REGENERATE DESCRIPTION WITH GEMINI
  app.post('/api/projects/regenerate-desc/:projectId', async (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa.' });
    }

    const { projectId } = req.params;
    const db = loadDb();
    const index = db.projects.findIndex((p) => p.id === projectId);

    if (index === -1) {
      return res.status(404).json({ error: 'Projek tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    const project = db.projects[index];
    const projectFolder = path.join(getProjectsDir(), projectId);

    if (!fs.existsSync(projectFolder)) {
      return res.status(404).json({ error: 'Folder fisik projek hilang di server.' });
    }

    // Scan physical folder for samples
    let briefDescription = 'Projek web statis diunggah secara lokal.';
    const gemini = getGeminiClient();

    if (gemini) {
      try {
        const physicalFiles = fs.readdirSync(projectFolder);
        let sampleContent = '';
        let sampleFileName = '';

        // Prioritize readme then index.html
        const readmeIndex = physicalFiles.findIndex(f => f.toLowerCase().endsWith('readme.md'));
        const htmlIndex = physicalFiles.findIndex(f => f.endsWith('index.html'));

        if (readmeIndex !== -1) {
          sampleFileName = physicalFiles[readmeIndex];
          sampleContent = fs.readFileSync(path.join(projectFolder, sampleFileName), 'utf-8');
        } else if (htmlIndex !== -1) {
          sampleFileName = physicalFiles[htmlIndex];
          sampleContent = fs.readFileSync(path.join(projectFolder, sampleFileName), 'utf-8');
        }

        if (sampleContent.length > 500) {
          sampleContent = sampleContent.substring(0, 500) + '...';
        }

        const prompt = `Analisis proyek web statis berikut:
Nama Proyek: ${project.name}
File tersedia: ${physicalFiles.join(', ')}
Isi Sampel File (${sampleFileName}): ${sampleContent}

Tugas: Buat deskripsi singkat (maksimal 15 kata) yang merangkum tujuan atau fungsi utama proyek ini dalam bahasa Indonesia. Deskripsi tersebut harus sopan, menarik, dan langsung menceritakan apa fungsi proyek itu. Tuliskan deskripsinya saja tanpa tanda petik atau metadata tambahan.`;

        const response = await gemini.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
        });

        if (response.text && response.text.trim().length > 0) {
          briefDescription = response.text.trim();
        }

        project.description = briefDescription;
        db.projects[index] = project;
        saveDb(db);
        return res.json({ success: true, description: briefDescription });
      } catch (err: any) {
        console.error('Gemini re-generation failed', err);
        return res.status(500).json({ error: `Gagal meregenerasi deskripsi: ${err.message}` });
      }
    } else {
      return res.status(400).json({ error: 'Kunci API Gemini tidak diatur. Fitur ini dinonaktifkan sementara.' });
    }
  });

  // DELETE PROJECT
  app.delete('/api/projects/:projectId', (req, res) => {
    const username = getLoggedInUsername(req);
    if (!username) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa. Silakan login kembali.' });
    }

    const { projectId } = req.params;
    const db = loadDb();
    const index = db.projects.findIndex((p) => p.id === projectId);

    if (index === -1) {
      return res.status(404).json({ error: 'Projek tidak ditemukan.' });
    }

    // Remove physical files
    const projectFolder = path.join(getProjectsDir(), projectId);
    try {
      deleteFolderRecursive(projectFolder);
    } catch (err) {
      console.error(`Failed to clean up files for project ${projectId}`, err);
    }

    // Remove record from Database
    db.projects.splice(index, 1);
    saveDb(db);

    return res.json({ success: true, message: 'Projek berhasil dihapus sepenuhnya dari server.' });
  });

  // Global error handler for API routes to never return HTML and cause JSON parser crash
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API Global Error Catch]', err);
    if (req.path.startsWith('/api/')) {
      return res.status(err.status || 500).json({
        error: err.message || 'Layanan server mengalami kendala internal. Hubungi pengembang portal.',
        details: String(err)
      });
    }
    next(err);
  });

  // --- Vite & Front-End Static Handler Integrations ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n======================================================`);
    console.log(`[FolderHostServer] Berjalan aman di port http://localhost:${PORT}`);
    console.log(`[PERHATIAN] Server berjalan pada Port 3000 sebagaimana ditetapkan oleh infrastruktur Cloud Run. Jangan ubah port ini.`);
    
    try {
      const diskspace = require('check-disk-space').default;
      const metrics = await diskspace('/'); // Assuming root mount for cloud
      console.log(`[System Storage] Total: ${(metrics.size / (1024*1024*1024)).toFixed(2)} GB`);
      console.log(`[System Storage] Used: ${((metrics.size - metrics.free) / (1024*1024*1024)).toFixed(2)} GB`);
      console.log(`[System Storage] Free: ${(metrics.free / (1024*1024*1024)).toFixed(2)} GB`);
    } catch(err) {
       console.log(`[System Storage] Gagal membaca metrics penyimpnan: ${err}`);
    }
    console.log(`======================================================\n`);
  });

  // Standalone & Local Network optimizations (prevents socket timeout on slow/LAN connections)
  server.timeout = 10 * 60 * 1000; // 10 minutes timeout for heavy file transfers
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.maxHeadersCount = 5000;
}

startServer();
