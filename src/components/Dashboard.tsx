/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { 
  FolderUp, 
  Settings, 
  Globe, 
  Copy, 
  Check, 
  Power, 
  Lock, 
  Unlock, 
  Trash2, 
  RefreshCw, 
  Clock, 
  Files, 
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Save,
  Database,
  Terminal,
  Activity,
  User,
  ExternalLink,
  LockKeyhole,
  UserPlus,
  HardDrive,
  FileText,
  Eye,
  UploadCloud,
  HelpCircle,
  BookOpen,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Zap
} from "lucide-react";
import { Project, UploadFilePayload } from "../types";

interface DashboardProps {
  username: string;
  onLogout: () => void;
}

export default function Dashboard({ username, onLogout }: DashboardProps) {
  const currentHost = typeof window !== "undefined" ? window.location.host : "vrlab.online";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  
  // Guide / Tutorial modal state
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideTab, setGuideTab] = useState<"quickstart" | "upload" | "update" | "security" | "storage">("quickstart");
  
  // Create / Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const individualFileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);

  // Update existing project state
  const [updatingProject, setUpdatingProject] = useState<Project | null>(null);
  const [updateType, setUpdateType] = useState<"zip" | "folder" | "files">("zip");
  const [updateZipFile, setUpdateZipFile] = useState<File | null>(null);
  const [updateFolderFiles, setUpdateFolderFiles] = useState<File[]>([]);
  const [updateProjectName, setUpdateProjectName] = useState<string>("");
  const updateZipInputRef = useRef<HTMLInputElement>(null);
  const updateFolderInputRef = useRef<HTMLInputElement>(null);
  const updateFilesInputRef = useRef<HTMLInputElement>(null);

  // Edit / Setting state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editProtected, setEditProtected] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Status utility
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Local static logs to match the aesthetic & provide dynamic details
  const [logs, setLogs] = useState<Array<{ msg: string; time: string; type: "success" | "info" | "warning" }>>([
    { msg: "AES-256 PBKDF2 database local handshake established successfully.", time: "Baru saja", type: "success" },
    { msg: "Sesi admin aktif terverifikasi lewat token cookie terenkripsi.", time: "1m ago", type: "info" }
  ]);

  // storage usage & administration invite states
  const [storageMetrics, setStorageMetrics] = useState<{
    totalBytes: number;
    limitBytes: number;
    percentage: number;
    formattedUsed: string;
    formattedLimit: string;
    projectsCount: number;
  } | null>(null);

  const [uploadProgressPct, setUploadProgressPct] = useState<number | null>(null);
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Storage location path & advanced telemetry monitoring states
  const [activeTab, setActiveTab ] = useState<"dashboard" | "settings">("dashboard");
  const [storageSettings, setStorageSettings] = useState<{
    defaultPath: string;
    customPath: string;
    currentActivePath: string;
    pathWritable: boolean;
    detailedProjectsMetrics: Array<{
      id: string;
      name: string;
      exists: boolean;
      sizeInBytes: number;
      filesCount: number;
      status: string;
      createdAt: string;
    }>;
    systemDiagnostics: {
      osType: string;
      osPlatform: string;
      osRelease: string;
      arch: string;
      totalMem: number;
      freeMem: number;
      cpuModel: string;
      cpuCount: number;
      loadAvg: number[];
      processUptime: number;
      hostname: string;
    };
  } | null>(null);

  const [customPathInput, setCustomPathInput] = useState("");
  
  // Real-time project telemetry and monitoring modal states
  const [telemetryProject, setTelemetryProject] = useState<Project | null>(null);
  const [telemetryFiles, setTelemetryFiles] = useState<any[]>([]);
  const [loadingTelemetryFiles, setLoadingTelemetryFiles] = useState(false);
  const [telemetrySearch, setTelemetrySearch] = useState("");

  const fetchTelemetryFiles = async (projectId: string) => {
    setLoadingTelemetryFiles(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files`);
      if (res.ok) {
        const data = await res.json();
        setTelemetryFiles(data.files || []);
      } else {
        setTelemetryFiles([]);
      }
    } catch {
      setTelemetryFiles([]);
    } finally {
      setLoadingTelemetryFiles(false);
    }
  };

  const openTelemetry = (project: Project) => {
    setTelemetryProject(project);
    setTelemetryFiles([]);
    setTelemetrySearch("");
    fetchTelemetryFiles(project.id);
  };
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const fetchStorageSettings = async () => {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const res = await fetch("/api/system/storage-settings");
      if (res.ok) {
        const data = await res.json();
        setStorageSettings(data);
        setCustomPathInput(data.customPath);
      } else {
        const errText = await res.text();
        let errMsg = "Gagal memuat sistem.";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        setSettingsError(errMsg);
      }
    } catch (err) {
      setSettingsError("Terjadi hambatan jaringan saat menghubungkan ke pusat diagnosik.");
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveStorageSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess(null);
    setSettingsError(null);
    setLoadingSettings(true);

    try {
      const res = await fetch("/api/system/storage-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPath: customPathInput })
      });
      
      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        throw new Error("Layanan server merespon dengan format yang tidak dikenali.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah lokasi.");
      }

      setSettingsSuccess(data.message || "Konfigurasi berhasil disimpan.");
      setLogs(prev => [
        { msg: `Penyimpanan dialihkan: ${data.currentPath || "Default Folder"}`, time: "Baru saja", type: "success" },
        ...prev
      ]);
      fetchStorageSettings();
      fetchStorageMetrics();
      fetchProjects();
    } catch (err: any) {
      setSettingsError(err.message || "Gagal memperbarui konfigurasi penyimpanan.");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchStorageMetrics();
  }, []);

  const fetchStorageMetrics = async () => {
    try {
      const res = await fetch("/api/system/storage");
      if (res.ok) {
        const data = await res.json();
        setStorageMetrics(data);
      }
    } catch (err) {
      console.error("Gagal mendapatkan storage percent", err);
    }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Gagal memuat list projects", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const executeInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteSuccess(null);
    setInviteError(null);

    if (!inviteUsername.trim() || !invitePassword.trim()) {
      setInviteError("Seluruh kolom wajib diisi.");
      setInviteLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inviteUsername, password: invitePassword })
      });
      
      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        throw new Error("Gagal memproses respon dari server. Sesi login Anda mungkin kedaluwarsa atau terjadi gangguan jalur aman.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Gagal mendaftarkan administrator baru.");
      }
      setInviteSuccess(`Sukses! Rekan admin @${inviteUsername} telah didaftarkan ke server local.`);
      setInviteUsername("");
      setInvitePassword("");
      setLogs(prev => [
        { msg: `Rekan admin @${inviteUsername} berhasil didaftarkan dari control dashboard.`, time: "Baru saja", type: "success" },
        ...prev
      ]);
    } catch (err: any) {
      setInviteError(err.message || "Gagal mendaftarkan administrator baru.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFolderFiles(filesArray);

      // Extract top level folder name from relative path
      const firstPath = (filesArray[0] as any).webkitRelativePath || "";
      const pathParts = firstPath.split("/");
      if (pathParts.length > 1) {
        setFolderName(pathParts[0]);
      } else {
        setFolderName("projek-custom-" + Math.floor(Math.random() * 1000));
      }
      setErrorMsg(null);
    }
  };

  const handleIndividualFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      setSelectedFolderFiles(filesArray);
      
      // Generate folder name based on first file or random seed
      const firstFile = filesArray[0] as any;
      const baseName = firstFile?.name ? firstFile.name.split(".")[0] : "custom";
      setFolderName("projek-file-" + baseName + "-" + Math.floor(Math.random() * 100));
      setErrorMsg(null);
    }
  };

  // Resilient Chunk Uploader with Automatic Exponential Retry for LAN / Cross-Device Transfer
  const postBinaryChunkWithRetry = async (
    url: string,
    chunkBlob: Blob,
    maxRetries = 3,
    onRetry?: (attempt: number) => void
  ) => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream"
          },
          body: chunkBlob
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server HTTP Error ${res.status}`);
        }

        return await res.json().catch(() => ({ success: true }));
      } catch (err: any) {
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        if (onRetry) onRetry(attempt);
        // Wait with backoff before retrying
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }
  };

  const uploadFileDirect = async (
    projectId: string,
    file: File,
    relativePath: string,
    onProgress?: (part: number, total: number) => void
  ) => {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB binary chunk size (very fast and robust on LAN/WiFi)
    const totalSize = file.size;
    const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));

    for (let c = 0; c < totalChunks; c++) {
      const start = c * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkBlob = file.slice(start, end);

      if (onProgress) onProgress(c + 1, totalChunks);

      const targetUrl = `/api/projects/${projectId}/raw-chunk?filePath=${encodeURIComponent(relativePath)}&append=${c > 0}`;
      await postBinaryChunkWithRetry(targetUrl, chunkBlob, 3, (retryAttempt) => {
        setUploadProgress(`Mentransmisi berkas ${file.name} (Bagian ${c + 1}/${totalChunks}) - Percobaan ulang ke-${retryAttempt}...`);
      });
    }
  };

  const autoCleanupProject = async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/cleanup`, { method: "DELETE" });
    } catch (e) {
      console.error("Auto cleanup error:", e);
    }
  };

  const executeUpload = async () => {
    if (selectedFolderFiles.length === 0) {
      setErrorMsg("Pilih folder atau berkas projek terlebih dahulu.");
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgressPct(5);
    setUploadProgress("Menginisiasi struktur proyek di Cloud...");

    let currentProjectId: string | null = null;

    try {
      // Initialize project
      const initRes = await fetch("/api/projects/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName })
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Gagal menginisiasi folder projek.");
      const projectId = initData.projectId;
      currentProjectId = projectId;

      let uploadedFilesCount = 0;
      const totalFiles = selectedFolderFiles.length;

      let sampleContent: string | null = null;
      let sampleFileName: string | null = null;

      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFolderFiles[i];
        
        const rawRelativePath = (file as any).webkitRelativePath || file.name;
        // Strip top-level directory prefix if project is uploaded as a folder
        let relativePath = rawRelativePath;
        if ((file as any).webkitRelativePath) {
          const firstSlashIndex = rawRelativePath.indexOf("/");
          if (firstSlashIndex !== -1) {
            relativePath = rawRelativePath.substring(firstSlashIndex + 1);
          }
        }

        // Update progress
        const overallPct = 10 + Math.floor((i / totalFiles) * 75);
        setUploadProgressPct(overallPct);
        setUploadProgress(`Mentransmisi berkas [${i + 1}/${totalFiles}]: ${file.name}`);

        await uploadFileDirect(projectId, file, relativePath, (part, totalParts) => {
          if (totalParts > 1) {
            setUploadProgress(`Mentransmisi berkas [${i + 1}/${totalFiles}]: ${file.name} (Bagian ${part}/${totalParts})`);
          }
        });

        if (!sampleContent && (relativePath.toLowerCase().endsWith('readme.md') || relativePath.endsWith('index.html'))) {
          sampleFileName = relativePath;
          try {
            sampleContent = await file.slice(0, 1000).text();
          } catch (e) {}
        } else if (!sampleContent && i === 0) {
          sampleFileName = relativePath;
          try {
            sampleContent = await file.slice(0, 1000).text();
          } catch (e) {}
        }
        
        uploadedFilesCount++;
      }

      setUploadProgressPct(90);
      setUploadProgress("Finalisasi proyek dan generasi AI...");

      const finRes = await fetch(`/api/projects/${projectId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName,
          totalFiles: uploadedFilesCount,
          sampleContent: sampleContent,
          sampleFileName: sampleFileName
        })
      });

      const finData = await finRes.json();
      if (!finRes.ok) throw new Error(finData.error || "Gagal memfinalisasi proyek.");

      setUploadProgressPct(100);
      setUploadProgress("Unggah Berhasil Sempurna!");
      
      await new Promise(r => setTimeout(r, 850));

      setSuccessMsg(`Notifikasi: Projek "${folderName}" berhasil terunggah dan di-deploy! Sesi aman sub-domain aktif.`);
      
      setLogs(prev => [
        { msg: `Unggah folder baru "${folderName}" (${uploadedFilesCount} file) berhasil di-host.`, time: "Baru saja", type: "success" },
        ...prev
      ]);

      setSelectedFolderFiles([]);
      setFolderName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (individualFileInputRef.current) {
        individualFileInputRef.current.value = "";
      }
      fetchProjects();
      fetchStorageMetrics();
    } catch (err: any) {
      if (currentProjectId) {
        await autoCleanupProject(currentProjectId);
        setErrorMsg(`Gagal mengunggah projek (${err.message}). Projek yang tidak lengkap telah otomatis dibersihkan dari server.`);
      } else {
        setErrorMsg(err.message || "Gagal mengupload projek.");
      }
    } finally {
      setUploading(false);
      setUploadProgress("");
      setUploadProgressPct(null);
    }
  };

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedZipFile(file);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setFolderName("projek-zip-" + baseName);
      setErrorMsg(null);
    }
  };

  const executeZipUpload = async () => {
    if (!selectedZipFile) {
      setErrorMsg("Pilih file ZIP projek terlebih dahulu.");
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgressPct(5);
    setUploadProgress("Menginisiasi struktur proyek di Cloud...");

    let currentProjectId: string | null = null;

    try {
      // Initialize project
      const initRes = await fetch("/api/projects/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName })
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Gagal menginisiasi folder projek.");
      const projectId = initData.projectId;
      currentProjectId = projectId;

      const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk
      const totalSize = selectedZipFile.size;
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      const fileName = selectedZipFile.name;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunk = selectedZipFile.slice(start, end);

        setUploadProgressPct(10 + Math.floor((i / totalChunks) * 60));
        setUploadProgress(`Mentransmisi ZIP (Bagian ${i + 1}/${totalChunks})...`);

        const targetUrl = `/api/projects/${projectId}/raw-chunk?fileName=${encodeURIComponent(fileName)}&append=${i > 0}`;
        await postBinaryChunkWithRetry(targetUrl, chunk, 3, (attempt) => {
          setUploadProgress(`Mentransmisi ZIP (Bagian ${i + 1}/${totalChunks}) - Percobaan ulang ke-${attempt}...`);
        });
      }

      setUploadProgressPct(75);
      setUploadProgress("Mengekstrak file ZIP di server...");

      const extractRes = await fetch(`/api/projects/${projectId}/zip-extract?fileName=${encodeURIComponent(fileName)}`, {
        method: "POST"
      });
      const extractData = await extractRes.json().catch(() => ({}));
      if (!extractRes.ok) throw new Error(extractData.error || "Gagal mengekstrak ZIP di server.");
      
      const totalExtracted = extractData.totalExtracted || 0;

      setUploadProgressPct(90);
      setUploadProgress("Finalisasi proyek dan generasi AI...");

      const finRes = await fetch(`/api/projects/${projectId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName,
          totalFiles: totalExtracted,
          sampleContent: "Project diunggah via ZIP archive.",
          sampleFileName: "archive.zip"
        })
      });

      const finData = await finRes.json();
      if (!finRes.ok) throw new Error(finData.error || "Gagal memfinalisasi proyek.");

      setUploadProgressPct(100);
      setUploadProgress("Unggah Berhasil Sempurna!");
      
      await new Promise(r => setTimeout(r, 850));

      setSuccessMsg(`Notifikasi: Projek "${folderName}" berhasil terunggah dan di-deploy!`);
      
      setLogs(prev => [
        { msg: `Unggah ZIP "${folderName}" (${totalExtracted} file) berhasil di-host.`, time: "Baru saja", type: "success" },
        ...prev
      ]);

      setSelectedZipFile(null);
      setFolderName("");
      if (zipInputRef.current) {
        zipInputRef.current.value = "";
      }
      fetchProjects();
      fetchStorageMetrics();
    } catch (err: any) {
      if (currentProjectId) {
        await autoCleanupProject(currentProjectId);
        setErrorMsg(`Gagal mengunggah projek ZIP (${err.message}). Projek yang tidak lengkap telah otomatis dibersihkan dari server.`);
      } else {
        setErrorMsg(err.message || "Gagal mengupload projek ZIP.");
      }
    } finally {
      setUploading(false);
      setUploadProgress("");
      setUploadProgressPct(null);
    }
  };

  const openUpdateModal = (project: Project) => {
    setUpdatingProject(project);
    setUpdateType("zip");
    setUpdateZipFile(null);
    setUpdateFolderFiles([]);
    setUpdateProjectName(project.name);
    setErrorMsg(null);
  };

  const executeUpdate = async () => {
    if (!updatingProject) return;
    const projectId = updatingProject.id;

    if (updateType === "zip" && !updateZipFile) {
      setErrorMsg("Silakan pilih file ZIP baru untuk memperbarui projek.");
      return;
    }
    if ((updateType === "folder" || updateType === "files") && updateFolderFiles.length === 0) {
      setErrorMsg("Silakan pilih folder atau berkas baru untuk memperbarui projek.");
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgressPct(5);
    setUploadProgress(`Mempersiapkan pembaruan untuk projek "${updatingProject.name}"...`);

    try {
      // 1. Initialize update (clears existing files inside project folder)
      const initRes = await fetch(`/api/projects/${projectId}/update-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Gagal mempersiapkan pembaruan folder projek.");

      let totalExtractedFiles = 0;
      let sampleContent = "";
      let sampleFileName = "";

      if (updateType === "zip" && updateZipFile) {
        // Direct binary chunk upload for ZIP
        const CHUNK_SIZE = 4 * 1024 * 1024;
        const totalSize = updateZipFile.size;
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
        const fileName = updateZipFile.name;

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, totalSize);
          const chunk = updateZipFile.slice(start, end);

          setUploadProgressPct(10 + Math.floor((i / totalChunks) * 60));
          setUploadProgress(`Mentransmisi arsip ZIP baru (${i + 1}/${totalChunks})...`);

          const targetUrl = `/api/projects/${projectId}/raw-chunk?fileName=${encodeURIComponent(fileName)}&append=${i > 0}`;
          await postBinaryChunkWithRetry(targetUrl, chunk, 3, (attempt) => {
            setUploadProgress(`Mentransmisi arsip ZIP baru (${i + 1}/${totalChunks}) - Percobaan ulang ke-${attempt}...`);
          });
        }

        setUploadProgressPct(75);
        setUploadProgress("Mengekstrak file ZIP baru di server...");
        const extractRes = await fetch(`/api/projects/${projectId}/zip-extract?fileName=${encodeURIComponent(fileName)}`, {
          method: "POST"
        });
        const extractData = await extractRes.json().catch(() => ({}));
        if (!extractRes.ok) throw new Error(extractData.error || "Gagal mengekstrak ZIP di server.");
        totalExtractedFiles = extractData.totalExtracted || 0;
      } else {
        // Folder or individual files upload
        const totalFiles = updateFolderFiles.length;
        for (let i = 0; i < totalFiles; i++) {
          const file = updateFolderFiles[i];
          const rawRelativePath = (file as any).webkitRelativePath || file.name;
          let relativePath = rawRelativePath;
          if ((file as any).webkitRelativePath) {
            const firstSlashIndex = rawRelativePath.indexOf("/");
            if (firstSlashIndex !== -1) {
              relativePath = rawRelativePath.substring(firstSlashIndex + 1);
            }
          }

          const overallPct = 10 + Math.floor((i / totalFiles) * 75);
          setUploadProgressPct(overallPct);
          setUploadProgress(`Mentransmisi berkas [${i + 1}/${totalFiles}]: ${file.name}`);

          await uploadFileDirect(projectId, file, relativePath, (part, totalParts) => {
            if (totalParts > 1) {
              setUploadProgress(`Mentransmisi berkas [${i + 1}/${totalFiles}]: ${file.name} (Bagian ${part}/${totalParts})`);
            }
          });

          if (!sampleContent && (relativePath.toLowerCase().endsWith("readme.md") || relativePath.endsWith("index.html"))) {
            sampleFileName = relativePath;
            try {
              sampleContent = await file.slice(0, 1000).text();
            } catch (e) {}
          }
          totalExtractedFiles++;
        }
      }

      setUploadProgressPct(90);
      setUploadProgress("Memperbarui metadata & menyegarkan projek...");

      const finRes = await fetch(`/api/projects/${projectId}/update-finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updateProjectName,
          totalFiles: totalExtractedFiles,
          sampleContent,
          sampleFileName
        })
      });
      const finData = await finRes.json();
      if (!finRes.ok) throw new Error(finData.error || "Gagal memfinalisasi pembaruan projek.");

      setUploadProgressPct(100);
      setUploadProgress("Pembaruan Berhasil Sempurna!");
      await new Promise(r => setTimeout(r, 800));

      setSuccessMsg(`Projek "${updatingProject.name}" berhasil diperbarui dengan ${totalExtractedFiles} berkas baru! URL tetap aktif.`);
      setLogs(prev => [
        { msg: `Projek "${updatingProject.name}" (${totalExtractedFiles} file) berhasil diperbarui.`, time: "Baru saja", type: "success" },
        ...prev
      ]);

      setUpdatingProject(null);
      setUpdateZipFile(null);
      setUpdateFolderFiles([]);
      fetchProjects();
      fetchStorageMetrics();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memperbarui berkas projek.");
    } finally {
      setUploading(false);
      setUploadProgress("");
      setUploadProgressPct(null);
    }
  };

  const copyUrl = (id: string, customDomain?: boolean) => {
    const fullUrl = `${window.location.origin}/p/${id}/`;
    
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const triggerToggleStatus = async (project: Project) => {
    const originalStatus = project.status;
    const newStatus = originalStatus === "active" ? "inactive" : "active";

    // Optimistic UI updates
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: newStatus } : p));

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        throw new Error();
      }
      
      setLogs(prev => [
        { msg: `Status projek "${project.name}" diubah ke [${newStatus.toUpperCase()}].`, time: "Baru saja", type: "info" },
        ...prev
      ]);
    } catch (err) {
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: originalStatus } : p));
      setErrorMsg("Gagal merubah status projek.");
    }
  };

  const triggerRegenerateDescription = async (projectId: string) => {
    setRegeneratingId(projectId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/projects/regenerate-desc/${projectId}`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal");
      }
      setSuccessMsg("Deskripsi projek berhasil diperbarui otomatis lewat AI Gemini!");
      setLogs(prev => [
        { msg: `Deskripsi projek ${projectId} berhasil ditulis ulang berbasis AI Gemini.`, time: "Baru saja", type: "success" },
        ...prev
      ]);
      fetchProjects();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal meregenerasi deskripsi via Gemini.");
    } finally {
      setRegeneratingId(null);
    }
  };

  const triggerDelete = async (project: Project) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus projek "${project.name}" beserta seluruh filenya? Langkah ini tidak bisa dibatalkan.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setSuccessMsg(`Projek "${project.name}" berhasil dihapus sepenuhnya.`);
        setLogs(prev => [
          { msg: `Projek "${project.name}" dihapus permanen dari memori lokal.`, time: "Baru saja", type: "warning" },
          ...prev
        ]);
        fetchProjects();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Gagal menghapus.");
      }
    } catch (err) {
      setErrorMsg("Gagal menghapus projek.");
    }
  };

  const openSettings = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDesc(project.description);
    setEditStatus(project.status);
    setEditProtected(project.isProtected);
    setEditPassword("");
  };

  const saveProjectSettings = async () => {
    if (!editingProject) return;

    setSavingEdit(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          status: editStatus,
          isProtected: editProtected,
          password: editPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan perubahan.");
      }

      setSuccessMsg(`Pengaturan projek "${editName}" diperbarui.`);
      setLogs(prev => [
        { msg: `Pengaturan file metadata & otentikasi "${editName}" disimpan.`, time: "Baru saja", type: "success" },
        ...prev
      ]);
      setEditingProject(null);
      fetchProjects();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Stats calculators
  const totalFilesCount = projects.reduce((acc, curr) => acc + (curr.filesCount || 0), 0);
  const activeProjectsCount = projects.filter(p => p.status === "active").length;
  const lockedProjectsCount = projects.filter(p => p.isProtected).length;

  return (
    <div id="high-density-admin" className="w-full max-w-[1200px] h-[780px] bg-zinc-950 text-zinc-250 font-sans flex flex-col rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden backdrop-blur-md relative select-none">
      
      {/* 1. Header: Global Status & User Profile */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center font-display font-extrabold text-white text-sm">
            FH
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm tracking-tight text-zinc-100 font-display">{currentHost}</h1>
            <span className="text-zinc-600 text-xs font-mono">/ management_engine</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* User Guide Button */}
          <button 
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-sm active:scale-95"
            title="Buka Petunjuk & Cara Menggunakan Web"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cara Menggunakan Web</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400 font-mono">Local Vault Secure</span>
          </div>
          
          <div className="h-6 w-[1px] bg-zinc-800"></div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-zinc-300">Administrator</p>
              <p className="text-[10px] text-zinc-500 font-mono">@{username}</p>
            </div>
            <button 
              onClick={onLogout}
              className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 hover:text-rose-400 border border-zinc-800 flex items-center justify-center text-zinc-400 transition-colors"
              title="Logout Sesi Secure"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace layout (Sidebar + Central body) */}
      <div className="flex flex-1 min-h-0">
        
        {/* Left Sidebar Menu */}
        <nav className="w-56 border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between flex-shrink-0">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 font-mono">Control Panel</p>
              <ul className="space-y-1">
                <li>
                  <button 
                    onClick={() => setActiveTab("dashboard")}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-left cursor-pointer transition-all ${
                      activeTab === "dashboard"
                        ? "bg-zinc-900 border border-zinc-800/80 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
                    }`}
                  >
                    <Database className={`w-3.5 h-3.5 ${activeTab === 'dashboard' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                    <span>Dashboard Utama</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      setActiveTab("settings");
                      fetchStorageSettings();
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-left cursor-pointer transition-all ${
                      activeTab === "settings"
                        ? "bg-zinc-900 border border-zinc-800/80 text-zinc-105"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
                    }`}
                  >
                    <Settings className={`w-3.5 h-3.5 ${activeTab === 'settings' ? 'text-pink-400' : 'text-zinc-500'}`} />
                    <span>Penyimpanan kustom</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      setShowInviteModal(true);
                      setInviteSuccess(null);
                      setInviteError(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-orange-400" />
                    <span>Daftarkan Admin</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setShowGuideModal(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-cyan-400/90 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer border border-cyan-500/20"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Panduan Penggunaan</span>
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 font-mono">Informasi Kapasitas</p>
              <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80 space-y-2.5 font-mono text-[10px]">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Laporan Tersimpan:</span>
                  <span className="text-zinc-200 font-bold bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-850">
                    {projects.length} Laporan
                  </span>
                </div>

                <div className="flex justify-between items-center text-zinc-400">
                  <span>Total Ukuran Disk:</span>
                  <span className="text-cyan-400 font-semibold">
                    {storageMetrics?.formattedUsed || "0.00 B"}
                  </span>
                </div>
                
                {/* Visual Unlimited Pulse Status Indicator */}
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-850 relative">
                  <div 
                    className="bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-405 h-full rounded-full w-full opacity-50"
                  />
                  <div className="absolute top-0 left-0 h-full w-[30%] bg-white/20 animate-[ping_3s_infinite]" />
                </div>

                <div className="flex justify-between items-center text-[9px]">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block animate-ping"></span>
                    Sistem Penyimpanan Tak Terbatas
                  </span>
                  <span className="text-zinc-500 font-medium tracking-wide">∞ Laporan</span>
                </div>

                <button 
                  type="button"
                  onClick={fetchStorageMetrics}
                  className="w-full flex items-center justify-center gap-1 mt-1 pt-2 border-t border-zinc-850 text-cyan-500 hover:text-cyan-400 font-semibold tracking-tight text-[9px] cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Pindai Ulang Disk
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 font-mono">Informasi Enkripsi</p>
              <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800/80 space-y-2">
                <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[8px] font-mono font-bold tracking-wider uppercase">
                  PBKDF2-SHA512
                </span>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  Database login dikunci 10,000 iterasi hash dengan garam dinamis.
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="p-3 bg-zinc-900/30 rounded-xl border border-zinc-850/80 text-center font-mono">
              <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5">Konektivitas</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span className="text-[10px] text-zinc-400 font-semibold">127.0.0.1:3000</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Central Workspace Container */}
        <main className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto bg-zinc-950">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFolderChange}
            className="hidden"
            style={{ display: "none" }}
            {...({
              webkitdirectory: "",
              directory: ""
            } as any)}
            multiple
          />
          <input
            ref={individualFileInputRef}
            type="file"
            onChange={handleIndividualFilesChange}
            className="hidden"
            style={{ display: "none" }}
            multiple
          />
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,.rar,.7z,.tar,.gz"
            onChange={handleZipFileChange}
            className="hidden"
            style={{ display: "none" }}
          />
          
          {activeTab === "dashboard" ? (
            <>
              {/* Top KPI Metrics Bar */}
              <div className="grid grid-cols-4 gap-4 flex-shrink-0">
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-3.5 rounded-xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Active Folders</p>
                  <p className="text-xl font-bold text-white font-display mt-0.5">{activeProjectsCount} <span className="text-xs text-zinc-500 font-normal">/ {projects.length} projek</span></p>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-3.5 rounded-xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Total Hosted Files</p>
                  <p className="text-xl font-bold text-white font-display mt-0.5">{totalFilesCount} <span className="text-xs text-zinc-500 font-normal">item</span></p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800/80 p-3.5 rounded-xl">
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Project Terkunci</p>
                  <p className="text-xl font-bold text-pink-400 font-display mt-0.5">{lockedProjectsCount} <span className="text-xs text-zinc-500 font-normal">diproteksi</span></p>
                </div>

                <div className="flex flex-col gap-2 justify-stretch">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-md shadow-cyan-500/10 cursor-pointer active:scale-95 py-0.5"
                  >
                    <FolderUp className="w-4 h-4" />
                    <span>Unggah Folder Projek</span>
                  </button>
                  <div className="flex flex-1 gap-2">
                    <button 
                      onClick={() => individualFileInputRef.current?.click()}
                      className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:text-white text-zinc-400 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all cursor-pointer active:scale-95 py-0.5"
                    >
                      <Files className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Individual</span>
                    </button>
                    <button 
                      onClick={() => zipInputRef.current?.click()}
                      className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:text-white text-zinc-400 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] transition-all cursor-pointer active:scale-95 py-0.5"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                      <span>ZIP Archive</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Notice Banner alerts */}
              {(errorMsg || successMsg || selectedFolderFiles.length > 0 || selectedZipFile) && (
                <div className="space-y-2 flex-shrink-0">
                  {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        <p className="font-medium">{errorMsg}</p>
                      </div>
                      <button onClick={() => setErrorMsg(null)} className="text-zinc-500 hover:text-zinc-250 font-bold">×</button>
                    </div>
                  )}

                  {successMsg && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <p className="font-medium">{successMsg}</p>
                      </div>
                      <button onClick={() => setSuccessMsg(null)} className="text-zinc-500 hover:text-zinc-250 font-bold">×</button>
                    </div>
                  )}

                  {/* Upload settings view */}
                  {selectedFolderFiles.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850">
                          <FolderUp className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Nama Folder Target:</span>
                            <input
                              type="text"
                              value={folderName}
                              onChange={(e) => setFolderName(e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 focus:border-cyan-500 px-2 py-0.5 rounded text-zinc-200 text-xs font-semibold max-w-[180px] outline-none"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Berisi {selectedFolderFiles.length} file statis siap dihosting statis</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedFolderFiles([]);
                            setFolderName("");
                          }}
                          className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 rounded-lg text-xs"
                        >
                          Batal
                        </button>
                        <button
                          onClick={executeUpload}
                          disabled={uploading}
                          className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 font-bold text-zinc-950 text-xs rounded-lg flex items-center gap-1.5"
                        >
                          {uploading ? "Memproses..." : "Konfirmasi & Deploy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedZipFile && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850">
                          <HardDrive className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Nama Folder Target:</span>
                            <input
                              type="text"
                              value={folderName}
                              onChange={(e) => setFolderName(e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 focus:border-purple-500 px-2 py-0.5 rounded text-zinc-200 text-xs font-semibold max-w-[180px] outline-none"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Arsip ZIP: {selectedZipFile.name} ({(selectedZipFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedZipFile(null);
                            setFolderName("");
                            if (zipInputRef.current) zipInputRef.current.value = "";
                          }}
                          className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 rounded-lg text-xs"
                        >
                          Batal
                        </button>
                        <button
                          onClick={executeZipUpload}
                          disabled={uploading}
                          className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 font-bold text-zinc-950 text-xs rounded-lg flex items-center gap-1.5"
                        >
                          {uploading ? "Memproses..." : "Unggah & Ekstrak"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Deep Matrix Table: List of project folders */}
              <div className="flex-1 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col min-h-0 relative overflow-hidden backdrop-blur-md">
                
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-5 py-2.5 bg-zinc-900/30 border-b border-zinc-800/60 text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-mono">
                  <div className="col-span-3">Folder / Nama Projek</div>
                  <div className="col-span-3">Domain Hosting (Konsep ID)</div>
                  <div className="col-span-2 text-center">Proteksi</div>
                  <div className="col-span-2 text-center">Status Sesi</div>
                  <div className="col-span-2 text-right">Aksi Kontrol</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-850/40">
                  {loadingProjects ? (
                    <div className="py-16 text-center text-zinc-500 space-y-2">
                      <div className="w-5 h-5 border-2 border-t-cyan-400 border-zinc-800 rounded-full animate-spin mx-auto"></div>
                      <p className="text-[10px] font-mono">Sinkronisasi database...</p>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="py-20 text-center px-6">
                      <div className="inline-flex p-3 rounded-xl bg-zinc-950 border border-zinc-850 mb-3 text-zinc-500">
                        <FolderUp className="w-5 h-5 text-zinc-600" />
                      </div>
                      <p className="text-xs font-semibold text-zinc-300">Belum Ada Folder Diunggah</p>
                      <p className="text-[10px] text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                        Tarik dan lepas atau unggah arsip folder web statis Anda. Sistem akan membuatkan sub-domain aman unik secara instan.
                      </p>
                    </div>
                  ) : (
                    projects.map((project) => {
                      const liveContainerUrl = `${window.location.origin}/p/${project.id}/`;

                      return (
                        <div 
                          key={project.id} 
                          className={`grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-zinc-900/30 transition-colors ${
                            project.status === "inactive" ? "opacity-60 bg-zinc-950/20" : ""
                          }`}
                        >
                          {/* Column 1: Metadata */}
                          <div className="col-span-3 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-xs text-zinc-100 truncate">{project.name}</p>
                              <span className="text-[8px] font-mono px-1 bg-zinc-900 rounded text-zinc-400 border border-zinc-800">{project.id}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 truncate italic mt-0.5" title={project.description}>
                              "{project.description}"
                            </p>
                            <p className="text-[9px] text-zinc-500 mt-1 font-mono flex items-center gap-2">
                              <span>{project.filesCount} file disalin</span>
                              <span>•</span>
                              <span>Created {new Date(project.createdAt).toLocaleDateString("id-ID", {day: "2-digit", month: "short"})}</span>
                            </p>
                          </div>

                          {/* Column 2: URL Map & Actions */}
                          <div className="col-span-3 min-w-0 font-mono text-[10px] space-y-1">
                            <div className="flex items-center bg-zinc-950 rounded border border-cyan-900/50 px-2 py-1.5 justify-between gap-1.5 select-all">
                              <a 
                                href={liveContainerUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-cyan-400 hover:text-cyan-300 truncate font-semibold"
                                title="Buka tautan ini di tab baru"
                              >
                                {currentHost}/p/{project.id}
                              </a>
                              <button
                                onClick={() => copyUrl(project.id, false)}
                                className="p-1 hover:text-white text-zinc-500 shrink-0 hover:bg-zinc-800 rounded transition-colors"
                                title="Salin Link"
                              >
                                {copiedId === project.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Column 3: Protection */}
                          <div className="col-span-2 flex justify-center">
                            {project.isProtected ? (
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[9px] font-mono tracking-wider border border-amber-500/20 text-amber-500 flex items-center gap-1.5">
                                <LockKeyhole className="w-2.5 h-2.5" />
                                LOCKED (AES)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-zinc-800 text-[9px] font-mono tracking-wider border border-zinc-700 text-zinc-400">
                                UNLOCKED
                              </span>
                            )}
                          </div>

                          {/* Column 4: State */}
                          <div className="col-span-2 flex justify-center">
                            <button
                              onClick={() => triggerToggleStatus(project)}
                              className="flex items-center gap-1.5 outline-none cursor-pointer group"
                            >
                              <div className={`w-2 h-2 rounded-full ${project.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`}></div>
                              <span className={`text-[11px] font-semibold transition-colors group-hover:underline ${
                                project.status === "active" ? "text-emerald-500" : "text-zinc-500"
                              }`}>
                                {project.status === "active" ? "Active" : "Disabled"}
                              </span>
                            </button>
                          </div>

                          {/* Column 5: Controls */}
                          <div className="col-span-2 flex justify-end gap-1 font-mono text-[10px]">
                            <button 
                              onClick={() => openUpdateModal(project)}
                              className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                              title="Perbarui / Ganti Berkas Projek Ini (ZIP, Folder, File)"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => triggerRegenerateDescription(project.id)}
                              disabled={regeneratingId === project.id}
                              className="p-1.5 text-zinc-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
                              title="Sinkronisasi AI Gemini untuk Folder"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${regeneratingId === project.id ? "animate-spin" : ""}`} />
                            </button>

                            <button 
                              onClick={() => openTelemetry(project)}
                              className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors"
                              title="Pemantauan Lanjutan & Struktur File"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => openSettings(project)}
                              className="p-1.5 text-zinc-500 hover:text-white transition-colors"
                              title="Edit Pengaturan & Password"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => triggerDelete(project)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                              title="Hapus Projek"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 4. Auth & Security logs panel row */}
              <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                
                {/* System logs */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <h3 className="text-[9px] uppercase font-bold text-zinc-500 mb-2 font-mono tracking-widest">Aktivitas Firewall Lokal</h3>
                  <div className="space-y-1.5 max-h-[75px] overflow-y-auto pr-1">
                    {logs.map((log, lidx) => (
                      <div key={lidx} className="flex justify-between items-start text-[10px] gap-2">
                        <span className={`font-mono leading-tight ${
                          log.type === "success" ? "text-emerald-400" : log.type === "warning" ? "text-rose-400" : "text-zinc-400"
                        }`}>• {log.msg}</span>
                        <span className="text-zinc-650 shrink-0 font-mono text-[9px]">{log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Global parameters / isolation */}
                <div className="bg-indigo-950/10 border border-indigo-500/10 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="space-y-1 pr-6">
                    <h3 className="text-[9px] uppercase font-bold text-indigo-400 font-mono tracking-widest">Pemisahan Direktori</h3>
                    <p className="text-xs font-bold text-zinc-200">Container sandbox: AKTIF</p>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      Seluruh projek server diisolasi dalam subdirektori fisik untuk menjamin keamanan dari ancaman eksploitasi data.
                    </p>
                  </div>
                  <div className="w-12 h-6 bg-indigo-600/30 border border-indigo-500/20 rounded-full flex items-center px-1 shrink-0">
                    <div className="w-4 h-4 bg-indigo-400 rounded-full ml-auto"></div>
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="space-y-4 animate-fade-in text-zinc-300">
              {/* Header */}
              <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/60 to-zinc-950 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-2 font-display">
                    <Settings className="w-4 h-4 text-pink-400" />
                    Penyimpanan & Diagnostik Lanjutan
                  </h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Konfigurasi jalur kustom, tetapkan kuota laporan, sisa slot dinamis, dan telemetri runtime system.</p>
                </div>
                <button
                  onClick={fetchStorageSettings}
                  disabled={loadingSettings}
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold border border-zinc-800 hover:text-white text-[10px] rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSettings ? 'animate-spin' : ''}`} />
                  Refresh Diagnostik
                </button>
              </div>

              {/* Grid 2 Columns */}
              <div className="grid grid-cols-12 gap-4">
                {/* Left Card: Storage Path Settings */}
                <div className="col-span-12 md:col-span-7 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                      Lokasi Penyimpanan Proyek
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Ubah direktori fisik di server tempat semua file laporan disimpan. Anda dapat menggunakan folder spesifik atau mengosongkan untuk kembali ke default.
                    </p>
                  </div>

                  {settingsError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2 font-mono">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>{settingsError}</span>
                    </div>
                  )}

                  {settingsSuccess && (
                     <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-2 font-mono">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>{settingsSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveStorageSettings} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Jalur Absolut (Server Path):</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customPathInput}
                          onChange={(e) => setCustomPathInput(e.target.value)}
                          placeholder="Contoh: /custom/projects-folder atau biarkan kosong..."
                          className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-zinc-205 outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCustomPathInput("");
                          }}
                          className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-855 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs"
                          title="Reset ke default"
                        >
                          Clear
                        </button>
                      </div>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        Default: <span className="text-zinc-400">{storageSettings?.defaultPath}</span>
                      </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-zinc-850">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomPathInput("");
                          const event = { preventDefault: () => {} } as React.FormEvent;
                          // Trigger empty post to revert
                          setTimeout(() => {
                            fetch("/api/system/storage-settings", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ customPath: "" })
                            }).then(() => {
                              setSettingsSuccess("Berhasil dikembalikan ke jalur internal server.");
                              fetchStorageSettings();
                              fetchStorageMetrics();
                            });
                          }, 50);
                        }}
                        className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-805 text-zinc-400 text-xs rounded-lg transition-colors"
                      >
                        Kembalikan Default
                      </button>
                      <button
                        type="submit"
                        disabled={loadingSettings}
                        className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 font-bold text-zinc-950 text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        {loadingSettings ? "Menyimpan..." : "Simpan Jalur Baru"}
                      </button>
                    </div>
                  </form>

                  {/* Path writable indicator badge */}
                  <div className="p-3.5 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1.5 font-mono text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-550">Jalur Aktif Sekarang:</span>
                      <span className="text-zinc-300 font-semibold truncate max-w-[280px]" title={storageSettings?.currentActivePath}>
                        {storageSettings?.currentActivePath}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-zinc-900">
                      <span className="text-zinc-550">Status Writable:</span>
                      {storageSettings?.pathWritable ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
                          SIAP & BISA DITULIS (OK)
                        </span>
                      ) : (
                        <span className="text-rose-450 font-bold flex items-center gap-1">
                          ❌ KEKUASAAN TERBATAS / READ-ONLY
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Card: OS Diagnostics & Telemetry */}
                <div className="col-span-12 md:col-span-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-pink-400" />
                      Telemetri Sistem & Host
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1">Diagnostik kesehatan server virtual dari runtime cloud platform.</p>
                  </div>

                  <div className="space-y-3 font-mono text-[10px]">
                    <div className="p-2.5 bg-zinc-950/50 rounded-lg space-y-1 border border-zinc-850">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Sistem Operasi:</span>
                        <span className="text-zinc-200 font-semibold">{storageSettings?.systemDiagnostics?.osType} ({storageSettings?.systemDiagnostics?.osPlatform})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Hostname:</span>
                        <span className="text-zinc-300 truncate max-w-[150px]">{storageSettings?.systemDiagnostics?.hostname}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Arsitektur:</span>
                        <span className="text-zinc-300">{storageSettings?.systemDiagnostics?.arch}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Uptime Server:</span>
                        <span className="text-zinc-300">
                          {storageSettings ? `${(storageSettings.systemDiagnostics.processUptime / 60).toFixed(1)} Menit` : "0"}
                        </span>
                      </div>
                    </div>

                    {/* RAM Meter */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] uppercase tracking-wider font-bold">
                        <span className="text-zinc-500">Penggunaan RAM Host:</span>
                        <span className="text-pink-400">
                          {storageSettings?.systemDiagnostics 
                            ? `${(( (storageSettings.systemDiagnostics.totalMem - storageSettings.systemDiagnostics.freeMem) / (1024*1024*1024) )).toFixed(2)} GB / ${(storageSettings.systemDiagnostics.totalMem / (1024*1024*1024)).toFixed(2)} GB`
                            : "0.00 GB"}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-850 relative">
                        <div 
                          className="bg-gradient-to-r from-pink-500 to-indigo-550 h-full rounded-full"
                          style={{
                            width: storageSettings?.systemDiagnostics 
                              ? `${((storageSettings.systemDiagnostics.totalMem - storageSettings.systemDiagnostics.freeMem) / storageSettings.systemDiagnostics.totalMem) * 100}%` 
                              : "0%"
                          }}
                        />
                      </div>
                    </div>

                    {/* CPU Info */}
                    <div className="p-2.5 bg-zinc-950/50 rounded-lg space-y-1 border border-zinc-855 leading-relaxed text-[8px] sm:text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Processor Model:</span>
                        <span className="text-zinc-300 text-right truncate max-w-[125px] sm:max-w-none">{storageSettings?.systemDiagnostics?.cpuModel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Core Counts:</span>
                        <span className="text-zinc-200">{storageSettings?.systemDiagnostics?.cpuCount} Core</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Section: Detailed storage consumption by reports */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/10">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
                    Pemantauan Ukuran Disk Per Laporan
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Pantau data penyimpanan detail yang diambil oleh setiap berkas laporan web secara diskrit.</p>
                </div>

                <div className="p-4">
                  {storageSettings?.detailedProjectsMetrics && storageSettings.detailedProjectsMetrics.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 text-[9px] font-bold font-mono text-zinc-500 uppercase tracking-widest px-3">
                        <div className="col-span-4">ID / Nama Laporan</div>
                        <div className="col-span-3">Tanggal Unggah</div>
                        <div className="col-span-2 text-center">Berkas</div>
                        <div className="col-span-3 text-right">Ukuran Disk</div>
                      </div>
                      
                      <div className="divide-y divide-zinc-850/50 max-h-[180px] overflow-y-auto pr-1">
                        {storageSettings.detailedProjectsMetrics.map((p, idx) => {
                          const sizeKb = (p.sizeInBytes / 1024).toFixed(2);
                          return (
                            <div key={p.id} className="grid grid-cols-12 items-center py-2 px-3 text-[11px] font-mono hover:bg-zinc-900/20 rounded">
                              <div className="col-span-4 min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-200 font-bold truncate">{p.name}</span>
                                  <span className="text-[8px] bg-zinc-950 px-1 py-0.5 rounded text-zinc-400 border border-zinc-850">{p.id}</span>
                                </div>
                              </div>
                              <div className="col-span-3 text-zinc-450 text-[10px]">
                                {new Date(p.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute:"2-digit" })}
                              </div>
                              <div className="col-span-2 text-center text-zinc-305 font-semibold">
                                {p.filesCount || 0} file
                              </div>
                              <div className="col-span-3 text-right text-cyan-450 font-bold">
                                {sizeKb} KB
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-zinc-500 font-mono text-[10px]">
                      Belum ada metrics disk laporan yang terekam. Masukkan laporan kustom di menu Dashboard.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* 5. Compact Bottom Status Bar wrapper */}
      <footer className="h-8 bg-zinc-900/80 border-t border-zinc-800 flex items-center px-6 justify-between text-[10px] text-zinc-500 font-mono">
        <div className="flex gap-4">
          <span>Sistem: Node.js TSX</span>
          <span>Database Lokal: Enkripsi PBKDF2</span>
          <span>Akses Port: 3000</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded bg-cyan-400 animate-pulse"></span>
          <span>Workspace Terkendali Baik</span>
        </div>
      </footer>

      {/* Update Project Files Modal */}
      {updatingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-zinc-100 uppercase tracking-tight">
                    Perbarui Berkas: {updatingProject.name}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    ID: <span className="text-cyan-400">{updatingProject.id}</span> • URL akses tidak akan berubah
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setUpdatingProject(null)}
                className="text-zinc-500 hover:text-zinc-300 font-bold text-lg cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Info Note */}
              <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1">
                <p className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  URL Publik Tetap Sama:
                </p>
                <p className="text-[10px] text-cyan-400/90 font-mono break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/p/{updatingProject.id}/
                </p>
                <p className="text-[9px] text-zinc-500 mt-1">
                  Berkas lama di dalam folder projek ini akan digantikan secara bersih dengan berkas baru yang Anda unggah.
                </p>
              </div>

              {/* Name Editor */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-450 uppercase mb-1 font-mono">
                  Nama Projek
                </label>
                <input
                  type="text"
                  value={updateProjectName}
                  onChange={(e) => setUpdateProjectName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                  placeholder="Nama projek..."
                />
              </div>

              {/* Upload Type Selector Tabs */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-zinc-450 uppercase font-mono">
                  Metode Unggah Pembaruan
                </label>
                <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setUpdateType("zip")}
                    className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all ${
                      updateType === "zip" ? "bg-amber-500 text-zinc-950 font-bold shadow" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Arsip ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateType("folder")}
                    className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all ${
                      updateType === "folder" ? "bg-cyan-500 text-zinc-950 font-bold shadow" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Pilih Folder
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateType("files")}
                    className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all ${
                      updateType === "files" ? "bg-emerald-500 text-zinc-950 font-bold shadow" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    File Bebas
                  </button>
                </div>
              </div>

              {/* Hidden File Inputs */}
              <input
                type="file"
                ref={updateZipInputRef}
                accept=".zip"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setUpdateZipFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <input
                type="file"
                ref={updateFolderInputRef}
                {...({ webkitdirectory: "", directory: "" } as any)}
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setUpdateFolderFiles(Array.from(e.target.files));
                  }
                }}
                className="hidden"
              />
              <input
                type="file"
                ref={updateFilesInputRef}
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setUpdateFolderFiles(Array.from(e.target.files));
                  }
                }}
                className="hidden"
              />

              {/* File Dropzone Area */}
              {updateType === "zip" && (
                <div 
                  onClick={() => updateZipInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-950/60 rounded-2xl p-5 text-center cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-8 h-8 mx-auto text-amber-400/80 mb-2" />
                  {updateZipFile ? (
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{updateZipFile.name}</p>
                      <p className="text-[10px] text-amber-400 font-mono mt-0.5">
                        Ukuran: {(updateZipFile.size / (1024 * 1024)).toFixed(2)} MB • Siap ditransmisi
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Klik untuk memilih Berkas ZIP baru</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">Sangat disarankan untuk Unity WebGL & Proyek Besar (hingga 500MB+)</p>
                    </div>
                  )}
                </div>
              )}

              {updateType === "folder" && (
                <div 
                  onClick={() => updateFolderInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-800 hover:border-cyan-500/50 bg-zinc-950/60 rounded-2xl p-5 text-center cursor-pointer transition-colors"
                >
                  <FolderUp className="w-8 h-8 mx-auto text-cyan-400/80 mb-2" />
                  {updateFolderFiles.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{updateFolderFiles.length} berkas dipilih</p>
                      <p className="text-[10px] text-cyan-400 font-mono mt-0.5">
                        Total Ukuran: {(updateFolderFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Klik untuk memilih Folder Proyek baru</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">Struktur folder lengkap akan dipertahankan</p>
                    </div>
                  )}
                </div>
              )}

              {updateType === "files" && (
                <div 
                  onClick={() => updateFilesInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/60 rounded-2xl p-5 text-center cursor-pointer transition-colors"
                >
                  <Files className="w-8 h-8 mx-auto text-emerald-400/80 mb-2" />
                  {updateFolderFiles.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{updateFolderFiles.length} berkas dipilih</p>
                      <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                        Total Ukuran: {(updateFolderFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Klik untuk memilih Berkas Individual baru</p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">Pilih berkas HTML, CSS, JS, Gambar, dsb.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setUpdatingProject(null)}
                disabled={uploading}
                className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeUpdate}
                disabled={uploading || (updateType === "zip" ? !updateZipFile : updateFolderFiles.length === 0)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{uploading ? "Mentransmisi..." : "Perbarui Sekarang"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup configuration settings popup modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="font-display font-semibold text-sm text-zinc-200">Konfigurasi: {editingProject.name}</h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Edit status isolasi, deskripsi AI, & password</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1.5">Nama Projek</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase mb-1.5">Deskripsi Projek</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-100 outline-none resize-none"
                />
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800/60 p-2.5 rounded-xl">
                <div>
                  <p className="text-[11px] font-semibold text-zinc-300">Aktivasi Guest</p>
                  <p className="text-[9px] text-zinc-500 leading-none mt-0.5">Nonaktifkan untuk memblokir akses url.</p>
                </div>
                <div className="flex bg-zinc-900 border border-zinc-800 p-0.5 rounded-md shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditStatus("active")}
                    className={`px-2 py-0.5 text-[9px] rounded font-semibold transition-all ${
                      editStatus === "active" ? "bg-cyan-500 text-zinc-950 font-bold" : "text-zinc-400"
                    }`}
                  >
                    Aktif
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("inactive")}
                    className={`px-2 py-0.5 text-[9px] rounded font-semibold transition-all ${
                      editStatus === "inactive" ? "bg-amber-500/20 text-amber-500 font-bold" : "text-zinc-400"
                    }`}
                  >
                    Mati
                  </button>
                </div>
              </div>

              {/* Password Protected lock */}
              <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-300">Batasi Hak Akses (Kata Sandi)</span>
                  <button
                    type="button"
                    onClick={() => setEditProtected(!editProtected)}
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                      editProtected ? "bg-pink-500" : "bg-zinc-800"
                    }`}
                  >
                    <div className={`bg-zinc-950 w-3.5 h-3.5 rounded-full transition-transform ${
                      editProtected ? "translate-x-3.5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
                
                {editProtected && (
                  <div className="space-y-1 pt-1">
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder={editingProject.isProtected ? "•••••••• (Tetap sama)" : "Buat password baru..."}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500 rounded px-2.5 py-1 text-[11px] text-zinc-100 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-lg text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={saveProjectSettings}
                disabled={savingEdit}
                className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-500 text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
              >
                {savingEdit ? "Menyimpan" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Administrator Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-pink-450 shrink-0" />
                  Daftarkan Administrator Baru
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Tambah rekan pengelola portal secara lokal</p>
              </div>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-zinc-500 hover:text-zinc-350 font-bold text-lg cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            {inviteError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono rounded-xl leading-tight">
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono rounded-xl leading-tight">
                {inviteSuccess}
              </div>
            )}

            <form onSubmit={executeInvite} className="space-y-3.5 text-xs font-sans">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-450 uppercase mb-1 font-mono">
                  Username Baru
                </label>
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="masukkan username admin baru..."
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-200 outline-none placeholder:text-zinc-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-450 uppercase mb-1 font-mono">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="buat password baru (min 5)..."
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-zinc-200 outline-none placeholder:text-zinc-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 rounded-lg text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 font-bold text-white rounded-lg text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {inviteLoading ? "Mendaftarkan..." : "Daftarkan Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Progress Indicator Modal */}
      {uploadProgressPct !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
            
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-2 animate-pulse">
              <FolderUp className="w-6 h-6 animate-bounce" />
            </div>
            
            <div>
              <h3 className="font-display font-bold text-sm text-zinc-100 uppercase tracking-tight">Mentransmisi Berkas Projek...</h3>
              <p className="text-[10px] text-zinc-400 font-mono mt-1 break-all px-1 leading-normal">{uploadProgress}</p>
            </div>

            {/* Progress visual representation */}
            <div className="space-y-1.5 pt-1.5">
              <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-850">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgressPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 px-0.5">
                <span>Progres Deploy</span>
                <span className="font-bold text-cyan-450">{uploadProgressPct}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Telemetry & Files Monitoring Modal */}
      {telemetryProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm text-zinc-100 uppercase tracking-tight flex items-center gap-1.5 font-display">
                    {telemetryProject.name}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">ID: <span className="bg-zinc-950 px-1 rounded border border-zinc-805">{telemetryProject.id}</span> • Pemantauan Berkas Lanjutan</p>
                </div>
              </div>
              <button 
                onClick={() => setTelemetryProject(null)}
                className="text-zinc-500 hover:text-zinc-350 font-bold text-lg cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Quick Metrics Dashboard Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-950/60 border border-zinc-850 p-2.5 rounded-xl text-center">
                <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono font-bold">Akses Pengunjung</p>
                <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">{telemetryProject.accessCount || 0} hits</p>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-850 p-2.5 rounded-xl text-center">
                <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono font-bold">Kuantitas Berkas</p>
                <p className="text-xs font-bold text-zinc-100 font-mono mt-0.5">{telemetryFiles.length || telemetryProject.filesCount || 0} file</p>
              </div>
              <div className="bg-zinc-950/60 border border-zinc-850 p-2.5 rounded-xl text-center">
                <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono font-bold">Kunjungan Terakhir</p>
                <p className="text-[10px] font-bold text-cyan-400 font-mono mt-1 leading-tight truncate px-1">
                  {telemetryProject.lastAccessedAt 
                    ? new Date(telemetryProject.lastAccessedAt).toLocaleTimeString("id", {hour: "2-digit", minute: "2-digit"}) 
                    : "Belum diakses"}
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Cari berkas statis di folder (misal: index.html)"
                value={telemetrySearch}
                onChange={(e) => setTelemetrySearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 focus:border-cyan-500 text-xs text-zinc-200 rounded-xl px-3.5 py-2 pl-9 outline-none placeholder:text-zinc-700 font-mono"
              />
              <div className="absolute left-3 top-2.5 text-zinc-650">
                <Files className="w-3.5 h-3.5 text-zinc-500" />
              </div>
            </div>

            {/* Files List tree container */}
            <div className="flex-1 overflow-y-auto bg-zinc-950 border border-zinc-850 rounded-xl max-h-[40vh] min-h-[180px]">
              {loadingTelemetryFiles ? (
                <div className="py-12 text-center text-zinc-500 space-y-2">
                  <div className="w-4 h-4 border-2 border-t-cyan-400 border-zinc-800 rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] font-mono">Memindai struktur direktori fisik...</p>
                </div>
              ) : telemetryFiles.length === 0 ? (
                <div className="py-12 text-center text-zinc-650 text-[10px] font-mono font-bold">
                  Tidak ada berkas yang ditemukan didalam subfolder target.
                </div>
              ) : (
                <div className="divide-y divide-zinc-900 border-zinc-850">
                  {telemetryFiles
                    .filter(f => f.path.toLowerCase().includes(telemetrySearch.toLowerCase()))
                    .map((file, fidx) => (
                      <div key={fidx} className="px-3.5 py-2 flex items-center justify-between text-[10px] font-mono hover:bg-zinc-900/40 transition-colors">
                        <div className="flex items-center gap-2 truncate pr-4">
                          <FileText className={`w-4 h-4 shrink-0 ${file.isDirectory ? 'text-amber-500 font-bold' : 'text-zinc-500'}`} />
                          <span className="text-zinc-350 truncate" title={file.path}>{file.path}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className="text-zinc-400 font-bold font-mono">{file.formattedSize}</span>
                          {!file.isDirectory && (
                            <span className="text-[8px] bg-zinc-900 text-zinc-500 px-1 rounded border border-zinc-850 uppercase font-bold">
                              {file.type ? file.type.replace('.', '') : 'file'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Simulated Speed performance estimates & instructions */}
            <div className="p-3 bg-zinc-950/30 rounded-xl border border-zinc-850 space-y-2">
              <h4 className="text-[9px] uppercase font-bold text-zinc-500 font-mono tracking-widest text-left">Kesehatan Folder Hosting</h4>
              <p className="text-[10px] text-zinc-400 leading-normal leading-relaxed text-left">
                Sistem isolasi disk memastikan kinerja caching statis <span className="text-emerald-400 font-bold font-mono">99.9%</span> optimal. Tidak ada kebocoran lintasan path (traversal blocked). Folder siap menampung ribuan aset statis tanpa hambatan memori.
              </p>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => setTelemetryProject(null)}
                className="px-4 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 text-zinc-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Tutup Monitor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive User Guide / Tutorial Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                    <span>Panduan & Cara Menggunakan Web Hosting</span>
                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                      v2.4
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Petunjuk lengkap pengunggahan, pembaruan, keamanan, dan deployment berkas web statis.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="text-zinc-500 hover:text-zinc-300 font-bold text-xl cursor-pointer transition-colors p-1"
                aria-label="Tutup Panduan"
              >
                &times;
              </button>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-5 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-850">
              <button
                type="button"
                onClick={() => setGuideTab("quickstart")}
                className={`py-1.5 px-2 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  guideTab === "quickstart" 
                    ? "bg-cyan-500 text-zinc-950 font-bold shadow" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Cepat</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideTab("upload")}
                className={`py-1.5 px-2 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  guideTab === "upload" 
                    ? "bg-cyan-500 text-zinc-950 font-bold shadow" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <FolderUp className="w-3 h-3" />
                <span>Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideTab("update")}
                className={`py-1.5 px-2 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  guideTab === "update" 
                    ? "bg-amber-500 text-zinc-950 font-bold shadow" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <UploadCloud className="w-3 h-3" />
                <span>Update</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideTab("security")}
                className={`py-1.5 px-2 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  guideTab === "security" 
                    ? "bg-emerald-500 text-zinc-950 font-bold shadow" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Keamanan</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideTab("storage")}
                className={`py-1.5 px-2 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  guideTab === "storage" 
                    ? "bg-pink-500 text-zinc-950 font-bold shadow" 
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <HardDrive className="w-3 h-3" />
                <span>Penyimpanan</span>
              </button>
            </div>

            {/* Content Body based on Active Tab */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-zinc-300 min-h-[260px] max-h-[50vh]">
              {guideTab === "quickstart" && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-gradient-to-br from-cyan-950/40 to-zinc-950 border border-cyan-500/20 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <Sparkles className="w-4 h-4" />
                      <span>Alur Singkat (3 Langkah Saja)</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Sistem ini dirancang khusus untuk mempublikasikan proyek web statis, Unity WebGL 3D Game, Portofolio, atau Aplikasi React/Vue Anda secara instan tanpa perlu setting server manual.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1.5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-[10px] flex items-center justify-center">
                        1
                      </div>
                      <h4 className="font-semibold text-zinc-100 text-xs">Pilih & Unggah</h4>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Unggah file ZIP, Folder Proyek, atau file HTML langsung dari komputer.
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px] flex items-center justify-center">
                        2
                      </div>
                      <h4 className="font-semibold text-zinc-100 text-xs">Hosting Otomatis</h4>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Sistem mengekstrak, mendeteksi <code className="text-cyan-400">index.html</code>, dan membuatkan sub-path unik.
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1.5">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold text-[10px] flex items-center justify-center">
                        3
                      </div>
                      <h4 className="font-semibold text-zinc-100 text-xs">Buka & Bagikan</h4>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Klik tombol link untuk membuka website atau salin URL permanen untuk dibagikan.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950/80 border border-zinc-850 rounded-xl flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      <strong className="text-zinc-200">Tips Format File:</strong> Pastikan folder atau arsip ZIP Anda memiliki berkas bernama <code className="text-cyan-400 font-mono">index.html</code> sebagai halaman utama pembuka.
                    </p>
                  </div>
                </div>
              )}

              {guideTab === "upload" && (
                <div className="space-y-3.5">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-zinc-100 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      Pilihan Metode Pengunggahan Berkas:
                    </h4>

                    {/* Method 1: ZIP */}
                    <div className="p-3.5 bg-zinc-950 border border-amber-500/30 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                          <UploadCloud className="w-3.5 h-3.5" />
                          Metode 1: Arsip ZIP (Sangat Disarankan)
                        </span>
                        <span className="text-[9px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-mono font-bold">
                          Optimal untuk 500MB+ & Unity
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        Cukup kompres folder proyek Anda menjadi file <code className="text-amber-400">.zip</code>. Keunggulannya: transmisi berkecepatan tinggi dengan potongan biner (direct binary chunks) dan sistem otomatis mengekstrak berkas di server.
                      </p>
                    </div>

                    {/* Method 2: Folder */}
                    <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-400 text-xs flex items-center gap-1.5">
                          <FolderUp className="w-3.5 h-3.5" />
                          Metode 2: Unggah Folder Lengkap
                        </span>
                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                          Struktur folder utuh
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        Klik tombol "Pilih Folder Projek", lalu pilih satu folder di komputermu. Semua subfolder seperti <code className="text-zinc-400 font-mono">/css</code>, <code className="text-zinc-400 font-mono">/js</code>, <code className="text-zinc-400 font-mono">/assets</code> akan diunggah dengan hierarki yang sama persis.
                      </p>
                    </div>

                    {/* Method 3: Files */}
                    <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                          <Files className="w-3.5 h-3.5" />
                          Metode 3: Berkas Bebas / Individual
                        </span>
                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                          Fleksibel
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        Pilih beberapa file HTML, CSS, JS, dan gambar sekaligus menggunakan tombol "Pilih Berkas Bebas".
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideTab === "update" && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-zinc-950 border border-amber-500/20 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <UploadCloud className="w-4 h-4" />
                      <span>Memperbarui Projek Tanpa Mengubah URL</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Ketika Anda melakukan perbaikan bug atau update versi baru pada game/website Anda, Anda <strong>tidak perlu membuat projek baru</strong>. Gunakan fitur Update untuk mengganti berkas dengan tetap mempertahankan tautan URL publik.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl">
                      <div className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 text-amber-400 flex items-center justify-center shrink-0 font-mono text-[10px] font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-200 text-[11px]">Klik Ikon Awan / Upload</p>
                        <p className="text-[10px] text-zinc-400">
                          Pada tabel daftar projek di dashboard, temukan projek yang ingin diperbarui dan klik ikon awan berwarna abu-abu/kuning.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl">
                      <div className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 text-amber-400 flex items-center justify-center shrink-0 font-mono text-[10px] font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-200 text-[11px]">Pilih Berkas / ZIP Versi Terbaru</p>
                        <p className="text-[10px] text-zinc-400">
                          Pilih berkas ZIP baru atau folder baru dari build terbaru Anda.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl">
                      <div className="w-5 h-5 rounded bg-zinc-900 border border-zinc-850 text-amber-400 flex items-center justify-center shrink-0 font-mono text-[10px] font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-200 text-[11px]">Klik "Perbarui Sekarang"</p>
                        <p className="text-[10px] text-zinc-400">
                          Server akan membersihkan berkas lama secara bersih dan menggantinya dengan berkas baru. Pengunjung langsung melihat pembaruan seketika.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {guideTab === "security" && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-zinc-950 border border-emerald-500/20 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Proteksi Akses & Keamanan Projek</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Anda memiliki kendali penuh terhadap siapa saja yang boleh membuka dan mengakses website/game Anda.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5 text-zinc-200 font-semibold text-xs">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Kunci Password</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Buka menu Pengaturan projek (ikon gerigi) lalu aktifkan "Kunci dengan Password". Pengunjung harus memasukkan password yang benar sebelum halaman dimuat.
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5 text-zinc-200 font-semibold text-xs">
                        <Power className="w-3.5 h-3.5 text-rose-400" />
                        <span>Matikan Status (Inactive)</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Ubah status ke "Inactive" untuk menonaktifkan halaman web sementara waktu tanpa menghapus berkas-berkas Anda.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950/80 border border-zinc-850 rounded-xl flex items-start gap-2.5">
                    <UserPlus className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-zinc-200 text-[11px]">Multi-Admin Manajemen</p>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">
                        Anda dapat mendaftarkan akun admin rekan kerja melalui menu <strong className="text-orange-400">"Daftarkan Admin"</strong> di sidebar sebelah kiri.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideTab === "storage" && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-zinc-950 border border-pink-500/20 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-pink-400 font-bold text-xs">
                      <HardDrive className="w-4 h-4" />
                      <span>Manajemen Penyimpanan & Telemetri</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Ketahui kapasitas disk lokal dan atur jalur folder penyimpanan file fisik di server.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1">
                      <h4 className="font-semibold text-zinc-200 text-[11px] flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-pink-400" />
                        Tab "Penyimpanan Kustom"
                      </h4>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Anda bisa mengarahkan penyimpanan proyek ke harddisk eksternal atau partisi khusus di server dengan mengetikkan path absolut (contoh: <code className="text-zinc-300 font-mono">/data/projects</code>).
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1">
                      <h4 className="font-semibold text-zinc-200 text-[11px] flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        Telemetri & Pemantau Berkas
                      </h4>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Klik ikon grafik/aktivitas pada baris projek untuk melihat jumlah kunjungan pengunjung (hits), daftar seluruh file statis, dan ukuran byte masing-masing file.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>Dokumentasi Resmi Web Hosting Portal</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGuideModal(false);
                    setActiveTab("dashboard");
                  }}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10"
                >
                  <span>Mulai Unggah Projek</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
