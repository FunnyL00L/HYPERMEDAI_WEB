/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HardDrive } from "lucide-react";
import LoginRegister from "./components/LoginRegister";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check user session auth state on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUsername(data.username);
          setAuthenticated(true);
        }
      }
    } catch (err) {
      console.error("Gagal memeriksa sesi login", err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setAuthenticated(false);
        setUsername("");
      }
    } catch (err) {
      console.error("Gagal melakukan penutupan sesi", err);
    }
  };

  if (checkingAuth) {
    return (
      <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col items-center justify-center p-6 font-sans select-none relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-zinc-950 to-zinc-950 -z-10"></div>
        <div className="space-y-4 text-center">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 border-2 border-cyan-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-t-cyan-400 rounded-full animate-spin"></div>
          </div>
          <div>
            <p className="font-display font-bold text-xs tracking-widest text-zinc-300 uppercase">Mengecek Sesi</p>
            <p className="text-[10px] text-zinc-500 mt-1 font-mono">Memvalidasi sertifikat & database lokal...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-zinc-200 min-h-screen flex flex-col font-sans relative selection:bg-cyan-500 selection:text-zinc-950 overflow-x-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/15 via-zinc-950 to-zinc-950 -z-20 pointer-events-none"></div>

      {/* Main Core View Area */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-6 lg:p-8 shrink-0">
        <AnimatePresence mode="wait">
          {!authenticated ? (
            <motion.div
              key="auth-view"
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -15 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm flex justify-center shrink-0"
            >
              <LoginRegister onLoginSuccess={(user) => {
                setUsername(user);
                setAuthenticated(true);
              }} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full shrink-0 flex justify-center"
            >
              <Dashboard username={username} onLogout={handleLogout} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding Margins */}
      <footer className="py-4 text-center border-t border-zinc-900/60 shrink-0 select-none z-10 pointer-events-none">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-zinc-600 text-[10px]">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-zinc-600" />
            <span>Database Lokal: <span className="font-semibold text-emerald-500">Terenkripsi Sempurna</span></span>
          </div>
          <p>© 2026 Folder Project Web Server — Diperkuat dengan AI Gemini.</p>
        </div>
      </footer>
    </div>
  );
}
