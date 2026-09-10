/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { KeyRound, Lock, UserPlus, ShieldCheck, HelpCircle, Phone, ArrowLeft, RefreshCw } from "lucide-react";

interface LoginRegisterProps {
  onLoginSuccess: (username: string) => void;
}

export default function LoginRegister({ onLoginSuccess }: LoginRegisterProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [registrationDisabled, setRegistrationDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentHost = typeof window !== "undefined" ? window.location.host : "vrlab.online";

  // Check Registration status on Mount
  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const res = await fetch("/api/auth/registration-status");
      if (res.ok) {
        const data = await res.json();
        setRegistrationDisabled(!!data.registrationDisabled);
      }
    } catch (err) {
      console.error("Gagal mengecek status pendaftaran", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Form inputs validation
    if (isForgotPassword) {
      if (!username.trim() || !adminPhone.trim() || !newPassword.trim()) {
        setError("Seluruh kolom wajib diisi.");
        return;
      }
      if (adminPhone !== "082147019988") {
        setError("Nomor telepon pemulihan admin salah.");
        return;
      }
    } else {
      if (!username.trim() || !password.trim()) {
        setError("Username dan password wajib diisi.");
        return;
      }
    }

    setLoading(true);

    try {
      let url = "";
      let payload = {};

      if (isForgotPassword) {
        url = "/api/auth/reset-password";
        payload = { username, adminPhone, newPassword };
      } else {
        url = isLogin ? "/api/auth/login" : "/api/auth/register";
        payload = { username, password };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        throw new Error("Layanan server tidak merespon dalam format yang benar. Pastikan parameter yang Anda kirimkan sesuai.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Terjadi kesalahan pada server.");
      }

      if (isForgotPassword) {
        setMessage("Lupa password berhasil! Kata sandi baru Anda telah diperbarui. Silakan login.");
        setIsForgotPassword(false);
        setIsLogin(true);
        setUsername("");
        setPassword("");
        setAdminPhone("");
        setNewPassword("");
      } else if (isLogin) {
        onLoginSuccess(data.username);
      } else {
        setMessage(data.message || "Pendaftaran administrator utama berhasil! Silakan login.");
        setUsername("");
        setPassword("");
        setIsLogin(true);
        checkRegistrationStatus(); // Update status since first admin is created
      }
    } catch (err: any) {
      setError(err.message || "Gagal memproses permintaan.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToRegister = () => {
    setIsForgotPassword(false);
    setIsLogin(false);
    setError(null);
    setMessage(null);
  };

  const handleSwitchToLogin = () => {
    setIsForgotPassword(false);
    setIsLogin(true);
    setError(null);
    setMessage(null);
  };

  const handleSwitchToForgotPassword = () => {
    setIsForgotPassword(true);
    setError(null);
    setMessage(null);
    setUsername("");
    setAdminPhone("");
    setNewPassword("");
  };

  return (
    <div id="login-container" className="w-full max-w-sm bg-zinc-900 border border-zinc-800 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-xl relative">
      <div className="p-6 relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-850 border border-zinc-700 p-2 text-white mb-2">
            <span className="font-display font-extrabold text-sm tracking-wider">VR</span>
          </div>
          <h1 className="font-display text-lg font-bold text-zinc-100 uppercase tracking-tight">
            {currentHost} <span className="text-zinc-500 font-normal">/ gate</span>
          </h1>
          <p className="text-[11px] text-zinc-400 max-w-[280px] mx-auto leading-relaxed">
            Upload, host, dan amankan folder projek HTML statis Anda dengan enkripsi lokal.
          </p>
        </div>

        {/* Tab Toggle (Only show if not in Forgot Password state) */}
        {!isForgotPassword ? (
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-2">
            <button
              type="button"
              onClick={handleSwitchToLogin}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isLogin
                  ? "bg-zinc-850 text-cyan-400 border border-zinc-800"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <KeyRound className="w-3 h-3" />
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={handleSwitchToRegister}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                !isLogin
                  ? "bg-zinc-850 text-cyan-400 border border-zinc-800"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <UserPlus className="w-3 h-3" />
              Daftar Baru
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSwitchToLogin}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-semibold"
          >
            <ArrowLeft className="w-3 h-3" />
            Kembali ke Halaman Login
          </button>
        )}

        {/* Info alerts */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
            <p className="font-mono text-[10px] leading-tight">{error}</p>
          </div>
        )}

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-xs flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5"></span>
            <p className="font-mono text-[10px] leading-tight">{message}</p>
          </div>
        )}

        {/* Conditional Forms rendering */}
        {isForgotPassword ? (
          /* FORGOT PASSWORD FORM */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl mb-4 text-[10px] text-zinc-450 leading-relaxed">
              <span className="text-amber-500 font-bold block mb-1">PROSEDUR PEMULIHAN SANDI MASTER:</span>
              Masukkan username admin dan nomor telepon pemulihan yang tepat untuk mereset sandi Anda dengan aman.
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                Username Admin
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="masukkan username admin..."
                required
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-zinc-200 outline-none transition-all placeholder:text-zinc-650"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                No. Telepon Master (Kunci Pemulihan)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-550">
                  <Phone className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="0821XXXXXXXX"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-2.5 text-zinc-200 outline-none transition-all placeholder:text-zinc-650 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                Password Baru Anda
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-550">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-2.5 text-zinc-200 outline-none transition-all placeholder:text-zinc-650"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold py-2.5 rounded-xl transition-all shadow-md mt-6 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "Mengevaluasi Kunci..." : "Atur Ulang Sandi Admin"}
            </button>
          </form>
        ) : !isLogin && registrationDisabled ? (
          /* REGISTRATION BLOCKED DISPLAY */
          <div className="space-y-4 py-3 text-center">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-left text-[11px] leading-relaxed">
              <span className="font-bold block mb-1">Registrasi Publik Dikunci 🔒</span>
              Mengingat administrator utama sudah terdaftar di sistem lokal, fitur registrasi dari luar ditutup demi keamanan master database.
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Rekan atau admin baru hanya bisa ditambahkan *dari dalam akun dashboard* oleh administrator aktif lewat menu <span className="text-cyan-400 font-semibold uppercase">Daftarkan Administrator</span>.
            </p>
            <button
              type="button"
              onClick={handleSwitchToLogin}
              className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-semibold"
            >
              Kembali ke Login Sesi
            </button>
          </div>
        ) : (
          /* STANDARD LOGIN / INITIAL REGISTER FORM */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-450 uppercase tracking-wider mb-1.5 font-mono">
                Username Administrator
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-550">
                  <span className="font-mono font-bold text-xs">@</span>
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="masukkan admin username..."
                  autoComplete="username"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-2.5 text-zinc-200 outline-none transition-all placeholder:text-zinc-650"
                />
              </div>
              {!isLogin && (
                <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                  Gunakan minimal 3 karakter huruf kecil/angka.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-semibold text-zinc-450 uppercase tracking-wider font-mono">
                  Local Hash Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleSwitchToForgotPassword}
                    className="text-[9.5px] text-cyan-450 hover:text-cyan-400 font-semibold cursor-pointer underline"
                  >
                    Lupa Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-550">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-2.5 text-zinc-200 outline-none transition-all placeholder:text-zinc-650"
                />
              </div>
              {!isLogin && (
                <p className="text-[9px] text-zinc-500 mt-1 font-mono">
                  Gunakan minimal 5 karakter sandi.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-bold py-2.5 rounded-xl transition-all shadow-md mt-6 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span>Memproses...</span>
              ) : isLogin ? (
                <span>Masuk ke Dashboard</span>
              ) : (
                <span>Daftar & Buat Akun</span>
              )}
            </button>
          </form>
        )}

        {/* Security Pledge Info */}
        <div className="flex items-start gap-2 bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-[10px] text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-zinc-300 font-mono">PBKDF2-SHA512 Enkripsi Vault</p>
            <p className="leading-relaxed text-zinc-500">
              Setiap password digarami secara acak dan di-hash 10k kali di memori lokal. Keamanan file server statis Anda terjaga sempurna.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
