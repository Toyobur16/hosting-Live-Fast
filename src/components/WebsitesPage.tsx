import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Archive,
  FileCode,
  Folder,
  Trash2,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Clock,
  Layers,
  Search,
  Eye,
  X,
  FileText,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { HostedWebsite, AuthUser } from '../types';

interface WebsitesPageProps {
  user: AuthUser | null;
  onOpenAuthModal: () => void;
  onNavigateToPlans: () => void;
  lang?: 'bn' | 'en';
}

export const WebsitesPage: React.FC<WebsitesPageProps> = ({
  user,
  onOpenAuthModal,
  onNavigateToPlans,
  lang = 'bn'
}) => {
  const [websites, setWebsites] = useState<HostedWebsite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Website Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteSlug, setNewSiteSlug] = useState('');
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [creatingSite, setCreatingSite] = useState(false);

  // Redeploy / Upload Modal
  const [deployTargetSite, setDeployTargetSite] = useState<HostedWebsite | null>(null);
  const [deployMethod, setDeployMethod] = useState<'zip' | 'files'>('zip');
  const [selectedZip, setSelectedZip] = useState<{ name: string; base64: string; size: number } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; content?: string; base64?: string; size: number }>>([]);
  const [uploadingDeploy, setUploadingDeploy] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // File browser modal
  const [browseSite, setBrowseSite] = useState<HostedWebsite | null>(null);
  const [fileList, setFileList] = useState<Array<{ path: string; size: number; modified: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Delete modal
  const [deleteTargetSite, setDeleteTargetSite] = useState<HostedWebsite | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWebsites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch('/api/websites', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.websites)) {
        setWebsites(data.websites);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, [user]);

  // Slug check debouncing
  useEffect(() => {
    if (!newSiteSlug.trim()) {
      setSlugAvailable(null);
      setSlugError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      setSlugError(null);
      try {
        const res = await fetch(`/api/websites/check-slug/${encodeURIComponent(newSiteSlug.trim())}`);
        const data = await res.json();
        setSlugAvailable(data.available);
        if (!data.available && data.error) {
          setSlugError(data.error);
        } else if (!data.available) {
          setSlugError(lang === 'bn' ? 'এই সাবডোমেনটি ইতোমধ্যে ব্যবহৃত হয়েছে' : 'Subdomain is already taken');
        }
      } catch {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [newSiteSlug, lang]);

  const handleNameChange = (val: string) => {
    setNewSiteName(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    setNewSiteSlug(autoSlug);
  };

  const handleCreateWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;

    setCreatingSite(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newSiteName.trim(),
          slug: newSiteSlug.trim()
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create website');
      }

      setShowNewModal(false);
      setNewSiteName('');
      setNewSiteSlug('');
      setSuccessMsg(
        lang === 'bn'
          ? `🎉 ওয়েবসাইট "${data.website?.name}" সফলভাবে তৈরি হয়েছে!`
          : `🎉 Website "${data.website?.name}" created successfully!`
      );
      fetchWebsites();
      // Prompt deploy
      if (data.website) {
        setDeployTargetSite(data.website);
      }
    } catch (err: any) {
      setError(err.message || 'Error creating website');
    } finally {
      setCreatingSite(false);
    }
  };

  const handleZipSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      setSelectedZip({
        name: file.name,
        base64,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFilesSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileListObj = e.target.files;
    if (!fileListObj || fileListObj.length === 0) return;

    const arr: Array<{ name: string; content?: string; base64?: string; size: number }> = [];
    for (let i = 0; i < fileListObj.length; i++) {
      const f = fileListObj[i];
      const isText = /\.(html|htm|css|js|json|svg|txt|xml|md|map)$/i.test(f.name);
      if (isText) {
        const text = await f.text();
        arr.push({ name: (f as any).webkitRelativePath || f.name, content: text, size: f.size });
      } else {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
          reader.readAsDataURL(f);
        });
        arr.push({ name: (f as any).webkitRelativePath || f.name, base64, size: f.size });
      }
    }
    setSelectedFiles(arr);
  };

  const handleExecuteDeploy = async () => {
    if (!deployTargetSite) return;
    setUploadingDeploy(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('bot_auth_token');
      if (deployMethod === 'zip') {
        if (!selectedZip) {
          throw new Error('অনুগ্রহ করে একটি ZIP ফাইল নির্বাচন করুন');
        }

        const res = await fetch(`/api/websites/${deployTargetSite.id}/deploy-zip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ zipBase64: selectedZip.base64 })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'ZIP deploy failed');
        }
      } else {
        if (selectedFiles.length === 0) {
          throw new Error('অনুগ্রহ করে এক বা একাধিক ফাইল নির্বাচন করুন');
        }

        const res = await fetch(`/api/websites/${deployTargetSite.id}/deploy-files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ files: selectedFiles })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Files deploy failed');
        }
      }

      setSuccessMsg(
        lang === 'bn'
          ? `🚀 "${deployTargetSite.name}" সফলভাবে ডিপ্লয় সম্পন্ন হয়েছে!`
          : `🚀 "${deployTargetSite.name}" successfully deployed!`
      );
      setDeployTargetSite(null);
      setSelectedZip(null);
      setSelectedFiles([]);
      fetchWebsites();
    } catch (err: any) {
      setError(err.message || 'Deploy error');
    } finally {
      setUploadingDeploy(false);
    }
  };

  const handleToggleStatus = async (site: HostedWebsite) => {
    try {
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch(`/api/websites/${site.id}/toggle-status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchWebsites();
      }
    } catch {}
  };

  const handleDeleteSite = async () => {
    if (!deleteTargetSite) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch(`/api/websites/${deleteTargetSite.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDeleteTargetSite(null);
        fetchWebsites();
      }
    } catch {} finally {
      setDeleting(false);
    }
  };

  const handleOpenBrowseFiles = async (site: HostedWebsite) => {
    setBrowseSite(site);
    setLoadingFiles(true);
    try {
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch(`/api/websites/${site.id}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setFileList(data.files);
      }
    } catch {
      setFileList([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const dm = 1;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const maxWebsites = user?.maxWebsites || (user?.role === 'admin' ? 999 : 2);
  const totalStorageBytes = websites.reduce((acc, curr) => acc + (curr.storageBytes || 0), 0);
  const activeCount = websites.filter((w) => w.status === 'online').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-br from-[#0c1427] via-[#091122] to-[#040813] border border-cyan-500/25 shadow-2xl mb-8">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-3">
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? '🌐 স্ট্যাটিক ওয়েবসাইট হোস্টিং' : '🌐 Static Website Cloud Hosting'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {lang === 'bn' ? 'আপনার নিজস্ব ওয়েবসাইট ও পোর্টফোলিও লাইভ হোস্ট করুন' : 'Host Static Websites with Free Subdomains'}
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-xl leading-relaxed">
              {lang === 'bn'
                ? 'HTML, CSS, JavaScript ও ইমেজ দিয়ে তৈরি ওয়েবসাইট সরাসরি ZIP বা ফাইল আপলোড করে ফ্রিতে সাবডোমেন সহ লাইভ পাবলিশ করুন।'
                : 'Upload HTML, CSS, JS, and image assets via ZIP or folder. Instantly live with free SSL and custom subdomains.'}
            </p>
          </div>

          <button
            onClick={() => {
              if (!user) {
                onOpenAuthModal();
              } else {
                setShowNewModal(true);
              }
            }}
            className="w-full md:w-auto px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{lang === 'bn' ? 'নতুন ওয়েবসাইট হোস্ট করুন' : 'Deploy New Website'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-950/50 border border-emerald-500/50 rounded-2xl text-emerald-300 text-sm flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 font-semibold">{successMsg}</div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-950/50 border border-rose-500/50 rounded-2xl text-rose-300 text-sm flex items-center gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#0b1222] border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{lang === 'bn' ? 'হোস্ট করা ওয়েবসাইট' : 'Total Websites'}</span>
          </div>
          <p className="text-xl font-bold text-white font-mono">
            {websites.length} / {maxWebsites}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {maxWebsites - websites.length} {lang === 'bn' ? 'টি স্লট বাকি আছে' : 'slots available'}
          </p>
        </div>

        <div className="bg-[#0b1222] border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'bn' ? 'অনলাইন সক্রিয় সাইট' : 'Online Sites'}</span>
          </div>
          <p className="text-xl font-bold text-emerald-400 font-mono">{activeCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">{lang === 'bn' ? 'লাইভ ভিজিটর রেডি' : 'Live & Serving'}</p>
        </div>

        <div className="bg-[#0b1222] border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span>{lang === 'bn' ? 'মোট স্টোরেজ ব্যবহার' : 'Storage Used'}</span>
          </div>
          <p className="text-xl font-bold text-purple-400 font-mono">{formatBytes(totalStorageBytes)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{lang === 'bn' ? 'ফাস্ট এসএসডি ক্লাউড' : 'Cloud SSD storage'}</p>
        </div>

        <div className="bg-[#0b1222] border border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>{lang === 'bn' ? 'SSL সিকিউরিটি' : 'SSL Protection'}</span>
          </div>
          <p className="text-xl font-bold text-amber-400 font-mono">HTTPS</p>
          <p className="text-[11px] text-slate-500 mt-1">{lang === 'bn' ? 'অটোমেটিক সার্টিফিকেট' : 'Auto Encrypted'}</p>
        </div>
      </div>

      {/* Website Cards Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p>{lang === 'bn' ? 'ওয়েবসাইট তালিকা লোড হচ্ছে...' : 'Loading websites...'}</p>
        </div>
      ) : websites.length === 0 ? (
        <div className="p-12 text-center bg-[#0b1222] border border-slate-800 rounded-3xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            {lang === 'bn' ? 'এখনো কোনো ওয়েবসাইট হোস্ট করা হয়নি' : 'No websites deployed yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            {lang === 'bn'
              ? 'আপনার তৈরি করা HTML ওয়েবসাইট বা পোর্টফোলিও আপলোড করে সরাসরি একটি ফ্রি সাবডোমেন পেয়ে যান।'
              : 'Deploy your first HTML website or portfolio and get a free instant subdomain with HTTPS.'}
          </p>
          <button
            onClick={() => {
              if (!user) {
                onOpenAuthModal();
              } else {
                setShowNewModal(true);
              }
            }}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'প্রথম ওয়েবসাইট হোস্ট করুন' : 'Deploy First Website'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {websites.map((site) => {
            const isOnline = site.status === 'online';
            const displayUrl = site.directUrl || `/site/${site.slug}/`;

            return (
              <div
                key={site.id}
                className="bg-[#0b1222] border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Status */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{site.name}</h3>
                        <p className="text-xs text-slate-400 font-mono">/{site.slug}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          isOnline
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                        <span>{isOnline ? (lang === 'bn' ? 'অনলাইন' : 'Online') : (lang === 'bn' ? 'বন্ধ' : 'Stopped')}</span>
                      </span>
                    </div>
                  </div>

                  {/* URL Card */}
                  <div className="bg-[#060c18] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2 mb-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        {lang === 'bn' ? 'ফ্রি লাইভ লিংক' : 'Free Live URL'}
                      </p>
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-400 hover:underline truncate block font-mono font-medium"
                      >
                        {site.subdomainUrl || displayUrl}
                      </a>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => copyToClipboard(site.subdomainUrl || window.location.origin + displayUrl, site.id)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title={lang === 'bn' ? 'লিংক কপি করুন' : 'Copy URL'}
                      >
                        {copiedId === site.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors cursor-pointer"
                        title={lang === 'bn' ? 'সাইট ওপেন করুন' : 'Open Website'}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-5">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatBytes(site.storageBytes)} ({site.filesCount || 0} {lang === 'bn' ? 'ফাইল' : 'files'})</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(site.lastDeployedAt || site.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeployTargetSite(site)}
                      className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'আপলোড / রিডিপ্লয়' : 'Redeploy'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenBrowseFiles(site)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'ফাইলস' : 'Files'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(site)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title={isOnline ? (lang === 'bn' ? 'সাইট বন্ধ করুন' : 'Stop Website') : (lang === 'bn' ? 'সাইট চালু করুন' : 'Start Website')}
                    >
                      {isOnline ? <Square className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>

                    <button
                      onClick={() => setDeleteTargetSite(site)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Website Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowNewModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {lang === 'bn' ? 'নতুন ওয়েবসাইট হোস্ট করুন' : 'Deploy New Website'}
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'bn' ? 'নাম ও পছন্দসই সাবডোমেন নির্ধারণ করুন' : 'Choose name and custom subdomain'}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateWebsite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'bn' ? 'ওয়েবসাইটের নাম (Website Name)' : 'Website Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'bn' ? 'যেমন: My Portfolio' : 'e.g. My Portfolio'}
                  value={newSiteName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0b1220] border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'bn' ? 'সাবডোমেন স্লাগ (Subdomain Slug)' : 'Free Subdomain Slug'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="my-portfolio"
                    value={newSiteSlug}
                    onChange={(e) => setNewSiteSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="w-full px-4 py-2.5 bg-[#0b1220] border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-cyan-400 pr-10"
                  />
                  <div className="absolute right-3 top-3">
                    {checkingSlug ? (
                      <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                    ) : slugAvailable === true ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : slugAvailable === false ? (
                      <X className="w-4 h-4 text-rose-400" />
                    ) : null}
                  </div>
                </div>

                <p className="text-[11px] text-cyan-400 mt-1 font-mono">
                  https://{newSiteSlug || 'your-name'}.hostinglivefast.cloud
                </p>

                {slugError && <p className="text-xs text-rose-400 mt-1">{slugError}</p>}
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed">
                💡 {lang === 'bn' ? 'ওয়েবসাইট তৈরির সাথে সাথে একটি ডিফল্ট index.html সেট হবে, যা আপনি পরবর্তীতে ZIP বা ফাইল আপলোড করে পরিবর্তন করতে পারবেন।' : 'A starter index.html will be generated. You can deploy your ZIP or files immediately after creation.'}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creatingSite || slugAvailable === false}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {creatingSite ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    lang === 'bn' ? 'তৈরি করুন' : 'Create Website'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deploy / Redeploy Modal */}
      {deployTargetSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => {
                setDeployTargetSite(null);
                setSelectedZip(null);
                setSelectedFiles([]);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {lang === 'bn' ? 'ফাইল আপলোড ও ডিপ্লয়' : 'Deploy Website Files'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {deployTargetSite.name} ({deployTargetSite.slug})
                </p>
              </div>
            </div>

            {/* Method Tabs */}
            <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => setDeployMethod('zip')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  deployMethod === 'zip'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>{lang === 'bn' ? 'পদ্ধতি ১: ZIP আপলোড' : 'Method A: Upload ZIP'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDeployMethod('files')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  deployMethod === 'files'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>{lang === 'bn' ? 'পদ্ধতি ২: মাল্টি-ফাইল আপলোড' : 'Method B: Upload Files'}</span>
              </button>
            </div>

            {/* Upload Area */}
            {deployMethod === 'zip' ? (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={zipInputRef}
                  accept=".zip"
                  onChange={handleZipSelection}
                  className="hidden"
                />
                <div
                  onClick={() => zipInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-cyan-400 rounded-2xl p-8 text-center bg-slate-900/50 hover:bg-slate-900 transition-all cursor-pointer"
                >
                  <Archive className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-white mb-1">
                    {selectedZip ? selectedZip.name : (lang === 'bn' ? 'একটি .ZIP ফাইল নির্বাচন করুন' : 'Click to select .ZIP file')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedZip
                      ? formatBytes(selectedZip.size)
                      : (lang === 'bn' ? 'index.html সহ আপনার পুরো ওয়েবসাইটের জিপ ফাইল' : 'Containing index.html, style.css, assets')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="file"
                  multiple
                  ref={filesInputRef}
                  onChange={handleFilesSelection}
                  className="hidden"
                />
                <div
                  onClick={() => filesInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-cyan-400 rounded-2xl p-8 text-center bg-slate-900/50 hover:bg-slate-900 transition-all cursor-pointer"
                >
                  <FileCode className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-white mb-1">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} ${lang === 'bn' ? 'টি ফাইল নির্বাচিত' : 'files selected'}`
                      : (lang === 'bn' ? 'ফাইলসমূহ নির্বাচন করুন' : 'Click to select multiple website files')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {lang === 'bn' ? 'HTML, CSS, JS, PNG, JPG, JSON ইত্যাদি' : 'HTML, CSS, JS, Images, JSON, Fonts'}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeployTargetSite(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={uploadingDeploy || (deployMethod === 'zip' ? !selectedZip : selectedFiles.length === 0)}
                onClick={handleExecuteDeploy}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold rounded-xl text-xs shadow transition-all cursor-pointer disabled:opacity-50"
              >
                {uploadingDeploy ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{lang === 'bn' ? 'ডিপ্লয় হচ্ছে...' : 'Deploying...'}</span>
                  </div>
                ) : (
                  lang === 'bn' ? 'লাইভ ডিপ্লয় করুন' : 'Deploy Website'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files Browser Modal */}
      {browseSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl max-w-xl w-full p-6 text-slate-100 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setBrowseSite(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {lang === 'bn' ? 'ওয়েবসাইট ফাইল ম্যানেজার' : 'Website File Explorer'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">{browseSite.name}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 border border-slate-800 rounded-2xl p-3 bg-slate-900/60">
              {loadingFiles ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                  <p className="text-xs">{lang === 'bn' ? 'ফাইল লোড হচ্ছে...' : 'Loading files...'}</p>
                </div>
              ) : fileList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  {lang === 'bn' ? 'কোনো ফাইল পাওয়া যায়নি' : 'No files found in directory'}
                </div>
              ) : (
                fileList.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0b1220] border border-slate-800/80 text-xs hover:border-slate-700"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-mono text-slate-300 truncate">{f.path}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                      {formatBytes(f.size)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setBrowseSite(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {lang === 'bn' ? 'ওয়েবসাইট মুছে ফেলবেন?' : 'Delete Website?'}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              {lang === 'bn'
                ? `আপনি কি নিশ্চিত যে "${deleteTargetSite.name}" এবং এর সমস্ত ফাইল স্থায়ীভাবে ডিলিট করতে চান?`
                : `Are you sure you want to permanently delete "${deleteTargetSite.name}" and all uploaded files?`}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteTargetSite(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                disabled={deleting}
                onClick={handleDeleteSite}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  lang === 'bn' ? 'হ্যাঁ, ডিলিট করুন' : 'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
