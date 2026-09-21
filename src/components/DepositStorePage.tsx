import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  ExternalLink,
  QrCode,
  Smartphone,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  Receipt,
  X,
  CreditCard,
  Building2,
  Coins,
  History,
  Info,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthUser, PaymentSettings, BinancePayOrder, CustomDepositMethod } from '../types';
import { playDepositSuccessSound } from '../utils/audioAlert';

interface DepositStorePageProps {
  user: AuthUser | null;
  onOpenAuthModal: () => void;
  onNavigateToPlans: () => void;
  onUserUpdated?: (user: AuthUser) => void;
  lang?: 'bn' | 'en';
}

interface StorePackage {
  id: string;
  usd: number;
  bdt: number;
  bonusPercent: number;
  bonusUsd: number;
  tag?: string;
  popular?: boolean;
  bestValue?: boolean;
  descriptionBn: string;
  descriptionEn: string;
}

const STORE_PACKAGES: StorePackage[] = [
  {
    id: 'pack_1',
    usd: 1,
    bdt: 120,
    bonusPercent: 0,
    bonusUsd: 0,
    tag: 'স্টার্টার',
    descriptionBn: '১টি বট হোস্টিং অথবা টেস্টের জন্য আদর্শ',
    descriptionEn: 'Ideal for 1 bot test or trial'
  },
  {
    id: 'pack_2',
    usd: 2,
    bdt: 240,
    bonusPercent: 0,
    bonusUsd: 0,
    tag: 'স্ট্যান্ডার্ড',
    descriptionBn: 'বেসিক হোস্টিং ও সম্পূর্ণ রিয়েলটাইম কনসোল',
    descriptionEn: 'Basic hosting with live terminal'
  },
  {
    id: 'pack_5',
    usd: 5,
    bdt: 600,
    bonusPercent: 5,
    bonusUsd: 0.25,
    popular: true,
    tag: 'সবচেয়ে জনপ্রিয়',
    descriptionBn: 'বোনাস সহ $5.25 ব্যালেন্স যোগ হবে',
    descriptionEn: 'Get $5.25 credit with +5% bonus'
  },
  {
    id: 'pack_10',
    usd: 10,
    bdt: 1200,
    bonusPercent: 10,
    bonusUsd: 1.0,
    tag: 'প্রো প্যাক',
    descriptionBn: 'বোনাস সহ $11.00 ব্যালেন্স যোগ হবে',
    descriptionEn: 'Get $11.00 credit with +10% bonus'
  },
  {
    id: 'pack_20',
    usd: 20,
    bdt: 2400,
    bonusPercent: 15,
    bonusUsd: 3.0,
    bestValue: true,
    tag: 'ভিআইপি ডিল',
    descriptionBn: 'বোনাস সহ $23.00 ব্যালেন্স যোগ হবে',
    descriptionEn: 'Get $23.00 credit with +15% bonus'
  },
  {
    id: 'pack_50',
    usd: 50,
    bdt: 6000,
    bonusPercent: 20,
    bonusUsd: 10.0,
    tag: 'এন্টারপ্রাইজ',
    descriptionBn: 'বোনাস সহ $60.00 ব্যালেন্স যোগ হবে',
    descriptionEn: 'Get $60.00 credit with +20% bonus'
  }
];

export function DepositStorePage({
  user,
  onOpenAuthModal,
  onNavigateToPlans,
  onUserUpdated,
  lang = 'bn'
}: DepositStorePageProps) {
  const [selectedPackageId, setSelectedPackageId] = useState<string>('pack_5');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    binanceUid: '922593999',
    binancePayId: '922593999',
    binanceId: '922593999',
    binanceBscAddress: '0xadf20566382613a481f39f62cd50b872314db1d3',
    binanceEnabled: true,
    binancePayApiEnabled: true,
    bkashNumber: '01614572747',
    bkashEnabled: true,
    nagadNumber: '01304104492',
    nagadEnabled: true,
    rocketNumber: '01304104492',
    rocketEnabled: true,
    customMethods: []
  });

  const [selectedGateway, setSelectedGateway] = useState<string>('binance');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Manual Submission Form
  const [senderIdentifier, setSenderIdentifier] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Instant Verification Tool Form
  const [verifyTrxId, setVerifyTrxId] = useState('');
  const [verifyingTrx, setVerifyingTrx] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  // Live Binance Order & Polling
  const [binanceOrder, setBinanceOrder] = useState<BinancePayOrder | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [isOrderPaid, setIsOrderPaid] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-sync & User Balance
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [creditedAmount, setCreditedAmount] = useState<number>(0);

  // Deposit History
  const [myDeposits, setMyDeposits] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'store' | 'verify' | 'history'>('store');

  const BDT_RATE = 120; // 1 USDT = 120 BDT

  // Calculate current final amount in USD and BDT
  const activeAmountUsd = useMemo(() => {
    if (isCustom) {
      const val = parseFloat(customAmount);
      return isNaN(val) || val <= 0 ? 0 : val;
    }
    const pack = STORE_PACKAGES.find((p) => p.id === selectedPackageId);
    return pack ? pack.usd : 5;
  }, [isCustom, customAmount, selectedPackageId]);

  const activeAmountBdt = Math.round(activeAmountUsd * BDT_RATE);

  const activeBonusUsd = useMemo(() => {
    if (isCustom) {
      if (activeAmountUsd >= 50) return Math.round(activeAmountUsd * 0.2 * 100) / 100;
      if (activeAmountUsd >= 20) return Math.round(activeAmountUsd * 0.15 * 100) / 100;
      if (activeAmountUsd >= 10) return Math.round(activeAmountUsd * 0.1 * 100) / 100;
      if (activeAmountUsd >= 5) return Math.round(activeAmountUsd * 0.05 * 100) / 100;
      return 0;
    }
    const pack = STORE_PACKAGES.find((p) => p.id === selectedPackageId);
    return pack ? pack.bonusUsd : 0;
  }, [isCustom, activeAmountUsd, selectedPackageId]);

  // Fetch payment settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/payment-settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setPaymentSettings(data.settings);
        }
      }
    } catch {}
  };

  // Fetch deposits history
  const fetchMyDeposits = async () => {
    const token = localStorage.getItem('bot_auth_token');
    if (!token) return;
    try {
      const res = await fetch('/api/wallet/my-deposits', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyDeposits(data.deposits || []);
        if (user && data.balanceUsd !== undefined && onUserUpdated) {
          if (data.balanceUsd !== user.balanceUsd) {
            onUserUpdated({
              ...user,
              balanceUsd: data.balanceUsd,
              balanceBdt: data.balanceBdt
            });
          }
        }
      }
    } catch {}
  };

  // Auto-sync user balance
  const handleAutoSync = async (silent = false) => {
    const token = localStorage.getItem('bot_auth_token');
    if (!token || !user) return;
    if (!silent) setIsSyncing(true);
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user && onUserUpdated) {
          onUserUpdated(data.user);
        }
      }
      await fetchMyDeposits();
    } catch {} finally {
      if (!silent) setTimeout(() => setIsSyncing(false), 400);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (user) {
      handleAutoSync(true);
    }
    const interval = setInterval(() => {
      if (user) handleAutoSync(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Copy helper
  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Create Live Binance Pay Order
  const handleCreateBinanceOrder = async () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    if (activeAmountUsd < 0.1) {
      setManualMessage({ type: 'error', text: 'সর্বনিম্ন ডিপোজিট পরিমাণ $0.10 USDT' });
      return;
    }

    try {
      setCreatingOrder(true);
      setManualMessage(null);
      setIsOrderPaid(false);
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch('/api/binance-pay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: activeAmountUsd })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBinanceOrder(data.order);
        startPollingOrder(data.order.orderId);
      } else {
        setManualMessage({ type: 'error', text: data.error || 'অর্ডার তৈরিতে সমস্যা হয়েছে।' });
      }
    } catch (err: any) {
      setManualMessage({ type: 'error', text: err.message || 'নেটওয়ার্ক এরর' });
    } finally {
      setCreatingOrder(false);
    }
  };

  // Start polling for Binance order payment
  const startPollingOrder = (orderId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const token = localStorage.getItem('bot_auth_token');

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/binance-pay/check-status?orderId=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.status === 'PAID') {
          clearInterval(pollingRef.current!);
          setIsOrderPaid(true);
          setCreditedAmount(data.amount || activeAmountUsd);
          setShowCelebration(true);
          playDepositSuccessSound();
          handleAutoSync();
        }
      } catch {}
    }, 3000);
  };

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Submit Manual Deposit Form
  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuthModal();
      return;
    }
    if (!senderIdentifier.trim()) {
      setManualMessage({ type: 'error', text: 'প্রেরক ফোন নাম্বার বা বাইন্যান্স আইডি লিখুন।' });
      return;
    }
    if (!transactionId.trim()) {
      setManualMessage({ type: 'error', text: 'Transaction ID (TrxID) লিখুন।' });
      return;
    }
    if (activeAmountUsd <= 0) {
      setManualMessage({ type: 'error', text: 'সঠিক পরিমাণ নির্ধারণ করুন।' });
      return;
    }

    try {
      setSubmittingManual(true);
      setManualMessage(null);
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: activeAmountUsd,
          currency: 'USD',
          method: selectedGateway,
          senderIdentifier: senderIdentifier.trim(),
          transactionId: transactionId.trim(),
          note: `ডিপোজিট স্টোর প্যাকেজ ($${activeAmountUsd} USDT)`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.autoApproved) {
          playDepositSuccessSound();
          setCreditedAmount(data.creditedAmount || activeAmountUsd);
          setShowCelebration(true);
        }
        setManualMessage({
          type: 'success',
          text: data.message || 'ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে!'
        });
        setSenderIdentifier('');
        setTransactionId('');
        handleAutoSync();
      } else {
        setManualMessage({ type: 'error', text: data.error || 'সাবমিট ব্যর্থ হয়েছে।' });
      }
    } catch (err: any) {
      setManualMessage({ type: 'error', text: err.message || 'নেটওয়ার্ক এরর' });
    } finally {
      setSubmittingManual(false);
    }
  };

  // Instant Verification via Binance Personal API
  const handleInstantVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuthModal();
      return;
    }
    if (!verifyTrxId.trim()) {
      setVerifyResult({ success: false, message: 'অনুগ্রহ করে Transaction ID বা Binance Pay ID দিন।' });
      return;
    }

    try {
      setVerifyingTrx(true);
      setVerifyResult(null);
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch('/api/binance-pay/verify-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId: verifyTrxId.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyResult({
          success: true,
          message: data.message || `সফলভাবে $${data.amount} USDT ওয়ালেটে যুক্ত হয়েছে!`
        });
        setCreditedAmount(data.amount);
        setShowCelebration(true);
        playDepositSuccessSound();
        setVerifyTrxId('');
        handleAutoSync();
      } else {
        setVerifyResult({
          success: false,
          message: data.error || 'ট্রানজেকশন মেলেনি। অনুগ্রহ করে ১-২ মিনিট পর আবার চেষ্টা করুন।'
        });
      }
    } catch (err: any) {
      setVerifyResult({
        success: false,
        message: err.message || 'সার্ভার সংযোগে ত্রুটি'
      });
    } finally {
      setVerifyingTrx(false);
    }
  };

  const selectedCustom = paymentSettings.customMethods?.find((cm) => cm.id === selectedGateway);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-2 sm:px-4 w-full overflow-x-hidden animate-in fade-in duration-200">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1424] via-[#09101c] to-[#060a12] border border-amber-500/30 p-5 sm:p-7 shadow-2xl shadow-amber-500/5">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-[#00d293]/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              <span>ডিপোজিট স্টোর (Deposit Store)</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-bold">লাইভ ডিপোজিট সক্রিয়</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              ইনস্ট্যান্ট ওয়ালেট <span className="text-amber-400">টপ-আপ ও ডিপোজিট</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              বাইনান্স (Binance Pay / USDT BEP-20) এর মাধ্যমে লাইভ অটো ডিপোজিট করুন অথবা বিকাশ, নগদ, রকেট ও কাস্টম মেথডে সহজেই ব্যালেন্স লোড করুন।
            </p>
          </div>

          {/* Current Balance Card with Live Sync Button */}
          <div className="shrink-0 p-4 sm:p-5 rounded-2xl bg-[#0e172a]/90 border border-[#1e2d48] flex flex-col gap-2 min-w-[240px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span>বর্তমান ওয়ালেট ব্যালেন্স</span>
              </span>
              <button
                type="button"
                onClick={() => handleAutoSync(false)}
                disabled={isSyncing}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="ব্যালেন্স রিফ্রেশ করুন"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white">
                ${Number(user?.balanceUsd || 0).toFixed(2)}
              </span>
              <span className="text-xs font-bold text-amber-400">USDT</span>
            </div>

            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2 mt-1">
              <span>সমপরিমাণ টাকা:</span>
              <span className="font-bold text-emerald-400">
                ৳{Math.round(Number(user?.balanceUsd || 0) * BDT_RATE)} BDT
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Store, Instant Verify, History) */}
      <div className="flex items-center gap-2 bg-[#090f1d] p-1.5 rounded-2xl border border-[#1a263d]">
        <button
          type="button"
          onClick={() => setActiveTab('store')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'store'
              ? 'bg-amber-400 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-[#111c30]'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>টপ-আপ প্যাকেজ ও মেথড</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('verify')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'verify'
              ? 'bg-amber-400 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-[#111c30]'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>⚡ ইনস্ট্যান্ট ট্রানজেকশন ভেরিফাই</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('history');
            fetchMyDeposits();
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-amber-400 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-[#111c30]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>ডিপোজিট হিস্ট্রি</span>
          {myDeposits.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'history' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {myDeposits.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: STORE PACKAGES & PAYMENT SELECTION */}
      {activeTab === 'store' && (
        <div className="space-y-6">
          {/* Step 1: Packages Section */}
          <div className="p-4 sm:p-6 rounded-3xl bg-[#0a101f] border border-[#1b2940] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">1</span>
                  <span>ডিপোজিট প্যাকেজ সিলেক্ট করুন (Select Package)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  যেকোনো প্যাকেজ পছন্দ করুন অথবা নিজের প্রয়োজনমতো এমাউন্ট লিখুন।
                </p>
              </div>
              <div className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 shrink-0">
                ১ USDT = ১২০ ৳ (BDT)
              </div>
            </div>

            {/* Packages Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {STORE_PACKAGES.map((pkg) => {
                const isSelected = !isCustom && selectedPackageId === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setIsCustom(false);
                      setSelectedPackageId(pkg.id);
                    }}
                    className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-lg scale-[1.02]'
                        : 'bg-[#0e1628] border-[#1e2f4a] hover:border-amber-400/50'
                    }`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[9px] shadow-sm">
                        POPULAR
                      </span>
                    )}
                    {pkg.bestValue && (
                      <span className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-[9px] shadow-sm">
                        BEST DEAL
                      </span>
                    )}

                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                        {pkg.tag}
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-black text-white">${pkg.usd}</span>
                        <span className="text-[10px] text-slate-400">USDT</span>
                      </div>
                      <div className="text-xs font-bold text-emerald-400">
                        ৳{pkg.bdt}
                      </div>
                    </div>

                    {pkg.bonusPercent > 0 && (
                      <div className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-center">
                        +{pkg.bonusPercent}% বোনাস
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Amount Option */}
            <div className="pt-2 border-t border-[#1a273e] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="customAmountCheck"
                  checked={isCustom}
                  onChange={(e) => setIsCustom(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="customAmountCheck" className="text-xs font-bold text-slate-200 cursor-pointer">
                  অন্য কোনো নির্দিষ্ট পরিমাণ ডিপোজিট করতে চান? (Custom Amount)
                </label>
              </div>

              {isCustom && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="e.g. 15"
                      className="w-32 bg-[#060a12] border border-amber-500/50 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-400">USDT</span>
                  <span className="text-xs font-bold text-emerald-400">
                    (= ৳{Math.round((parseFloat(customAmount) || 0) * BDT_RATE)} BDT)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Payment Gateways Section */}
          <div className="p-4 sm:p-6 rounded-3xl bg-[#0a101f] border border-[#1b2940] space-y-5">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">2</span>
                <span>ডিপোজিট মেথড নির্বাচন করুন (Select Method)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                বাইনান্স লাইভ অটো ডিপোজিট অথবা বিকাশ, নগদ, রকেট ও কাস্টম মেথড নির্বাচন করুন।
              </p>
            </div>

            {/* Gateways Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Binance */}
              {paymentSettings.binanceEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setSelectedGateway('binance')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    selectedGateway === 'binance'
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 shadow-xl scale-[1.02]'
                      : 'bg-[#0e1628] border-[#1e2f4a] hover:border-amber-400/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-base border border-amber-500/40 shrink-0">
                      ₮
                    </div>
                    <div>
                      <span className="text-xs font-black text-white block">Binance Pay</span>
                      <span className="text-[10px] text-amber-400 font-bold block flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        লাইভ অটো ডিপোজিট
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">UID / Pay ID / BEP20</span>
                </button>
              )}

              {/* bKash */}
              {paymentSettings.bkashEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setSelectedGateway('bkash')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    selectedGateway === 'bkash'
                      ? 'bg-pink-500/20 border-pink-500 ring-2 ring-pink-500/40 shadow-xl scale-[1.02]'
                      : 'bg-[#0e1628] border-[#1e2f4a] hover:border-pink-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {paymentSettings.bkashQrUrl ? (
                      <img src={paymentSettings.bkashQrUrl} alt="bKash" className="w-9 h-9 rounded-xl object-cover border border-pink-500/40 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-black text-xs border border-pink-500/40 shrink-0">
                        বিকাশ
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-black text-white block">bKash (বিকাশ)</span>
                      <span className="text-[10px] text-pink-400 font-bold block">Send Money</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">{paymentSettings.bkashNumber}</span>
                </button>
              )}

              {/* Nagad */}
              {paymentSettings.nagadEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setSelectedGateway('nagad')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    selectedGateway === 'nagad'
                      ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/40 shadow-xl scale-[1.02]'
                      : 'bg-[#0e1628] border-[#1e2f4a] hover:border-orange-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {paymentSettings.nagadQrUrl ? (
                      <img src={paymentSettings.nagadQrUrl} alt="Nagad" className="w-9 h-9 rounded-xl object-cover border border-orange-500/40 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs border border-orange-500/40 shrink-0">
                        নগদ
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-black text-white block">Nagad (নগদ)</span>
                      <span className="text-[10px] text-orange-400 font-bold block">Send Money</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">{paymentSettings.nagadNumber}</span>
                </button>
              )}

              {/* Rocket */}
              {paymentSettings.rocketEnabled !== false && (
                <button
                  type="button"
                  onClick={() => setSelectedGateway('rocket')}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    selectedGateway === 'rocket'
                      ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/40 shadow-xl scale-[1.02]'
                      : 'bg-[#0e1628] border-[#1e2f4a] hover:border-purple-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {paymentSettings.rocketQrUrl ? (
                      <img src={paymentSettings.rocketQrUrl} alt="Rocket" className="w-9 h-9 rounded-xl object-cover border border-purple-500/40 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-xs border border-purple-500/40 shrink-0">
                        রকেট
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-black text-white block">Rocket (রকেট)</span>
                      <span className="text-[10px] text-purple-400 font-bold block">Send Money</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">{paymentSettings.rocketNumber}</span>
                </button>
              )}

              {/* Custom Methods added from Admin Panel with direct pictures */}
              {paymentSettings.customMethods?.filter((cm) => cm.enabled !== false).map((cm) => (
                <button
                  key={cm.id}
                  type="button"
                  onClick={() => setSelectedGateway(cm.id)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                    selectedGateway === cm.id
                      ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/40 shadow-xl scale-[1.02]'
                      : 'bg-[#0e1628] border-[#1e2f4a] hover:border-emerald-400/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {cm.imageUrl ? (
                      <img src={cm.imageUrl} alt={cm.name} className="w-9 h-9 rounded-xl object-cover border border-emerald-400/40 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-400/40 shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-black text-white block truncate">{cm.name}</span>
                      <span className="text-[10px] text-emerald-400 font-bold block truncate">কাস্টম মেথড</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">{cm.account || 'Direct Pay'}</span>
                </button>
              ))}
            </div>

            {/* Gateway Details & Action Panel */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#070c17] border border-[#172338] space-y-4">
              {/* Selected Amount Summary Pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#0b1324] border border-[#1b2b45]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">নির্বাচিত ডিপোজিট পরিমাণ:</span>
                  <span className="text-sm font-black text-amber-400">${activeAmountUsd} USDT</span>
                  <span className="text-xs font-bold text-slate-400">(= ৳{activeAmountBdt} BDT)</span>
                </div>
                {activeBonusUsd > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    <span>মোট ক্রেডিট হবে: ${(activeAmountUsd + activeBonusUsd).toFixed(2)} USDT</span>
                  </span>
                )}
              </div>

              {/* DETAILS FOR BINANCE PAY */}
              {selectedGateway === 'binance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Binance IDs & Instructions */}
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-[#0a1120] border border-[#1b2b48] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Binance Pay ID / UID:</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(paymentSettings.binancePayId || '922593999', 'payId')}
                            className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            {copiedField === 'payId' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'payId' ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                          </button>
                        </div>
                        <div className="text-sm font-mono font-black text-amber-400 bg-[#060a12] p-2.5 rounded-lg border border-slate-800">
                          {paymentSettings.binancePayId || paymentSettings.binanceUid || '922593999'}
                        </div>
                      </div>

                      {/* Binance BEP20 Address */}
                      <div className="p-3.5 rounded-xl bg-[#0a1120] border border-[#1b2b48] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Binance USDT Address (BEP-20 / BSC):</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(paymentSettings.binanceBscAddress || '0xadf20566382613a481f39f62cd50b872314db1d3', 'bscAddr')}
                            className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            {copiedField === 'bscAddr' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'bscAddr' ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                          </button>
                        </div>
                        <div className="text-[11px] font-mono font-black text-amber-300 bg-[#060a12] p-2 rounded-lg border border-slate-800 break-all">
                          {paymentSettings.binanceBscAddress || '0xadf20566382613a481f39f62cd50b872314db1d3'}
                        </div>
                      </div>

                      {/* Quick Direct Links */}
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`binance://payment/pay?merchantId=${paymentSettings.binancePayId || '922593999'}&amount=${activeAmountUsd}`}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>বাইনান্স অ্যাপে ওপেন করুন</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleCreateBinanceOrder}
                          disabled={creatingOrder}
                          className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                        >
                          {creatingOrder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>⚡ লাইভ অটো-চেকার চালু করুন</span>
                        </button>
                      </div>
                    </div>

                    {/* QR Code & Live Status */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#090f1e] border border-[#1b2a45] text-center space-y-3">
                      <div className="p-2 bg-white rounded-2xl shadow-lg border border-amber-400/40">
                        <img
                          src={
                            paymentSettings.binanceQrUrl ||
                            `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://app.binance.com/qr/dop?id=${paymentSettings.binancePayId || '922593999'}`
                          }
                          alt="Binance QR"
                          className="w-36 h-36 object-contain"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-black text-white block">স্ক্যান করে $ {activeAmountUsd} USDT সেন্ড করুন</span>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          বাইনান্স অ্যাপ দিয়ে কিউআর স্ক্যান করলেই সরাসরি ট্রান্সফার হবে
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Order Monitoring Notification */}
                  {binanceOrder && !isOrderPaid && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-300">
                            লাইভ পেমেন্ট পর্যবেক্ষণ করা হচ্ছে (Order #{binanceOrder.merchantTradeNo})
                          </p>
                          <p className="text-[11px] text-slate-400">
                            বাইনান্সে লেনদেন সম্পন্ন হওয়ামাত্রই সার্ভার স্বয়ংক্রিয়ভাবে শনাক্ত করে ওয়ালেটে ব্যালেন্স যোগ করবে।
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DETAILS FOR BKASH / NAGAD / ROCKET / CUSTOM */}
              {selectedGateway !== 'binance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      {/* Account Number Card */}
                      <div className="p-3.5 rounded-xl bg-[#0a1120] border border-[#1b2b48] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">
                            {selectedGateway === 'bkash'
                              ? 'bKash (বিকাশ) নাম্বার (Send Money):'
                              : selectedGateway === 'nagad'
                              ? 'Nagad (নগদ) নাম্বার (Send Money):'
                              : selectedGateway === 'rocket'
                              ? 'Rocket (রকেট) নাম্বার (Send Money):'
                              : `${selectedCustom?.name || 'কাস্টম'} একাউন্ট তথ্য:`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const num =
                                selectedGateway === 'bkash'
                                  ? paymentSettings.bkashNumber
                                  : selectedGateway === 'nagad'
                                  ? paymentSettings.nagadNumber
                                  : selectedGateway === 'rocket'
                                  ? paymentSettings.rocketNumber
                                  : selectedCustom?.account || '';
                              handleCopy(num, 'accNum');
                            }}
                            className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            {copiedField === 'accNum' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'accNum' ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                          </button>
                        </div>

                        <div className="text-base font-mono font-black text-amber-400 bg-[#060a12] p-2.5 rounded-lg border border-slate-800">
                          {selectedGateway === 'bkash'
                            ? paymentSettings.bkashNumber
                            : selectedGateway === 'nagad'
                            ? paymentSettings.nagadNumber
                            : selectedGateway === 'rocket'
                            ? paymentSettings.rocketNumber
                            : selectedCustom?.account}
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="p-3 rounded-xl bg-[#090f1d] border border-slate-800 text-xs text-slate-300 leading-relaxed">
                        <span className="font-bold text-amber-400 block mb-1">পেমেন্ট নির্দেশনা:</span>
                        {selectedCustom?.instructions ||
                          paymentSettings.instructionsBn ||
                          'উপরের নাম্বারে উল্লেখিত পরিমাণ টাকা Send Money করুন। সফল হলে প্রাপ্ত Transaction ID (TrxID) এবং আপনার ফোন নাম্বার নিচে দিয়ে সাবমিট করুন।'}
                      </div>
                    </div>

                    {/* Method Picture / QR Code from Admin */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#090f1e] border border-[#1b2a45] text-center space-y-3">
                      {(selectedGateway === 'bkash' && paymentSettings.bkashQrUrl) ||
                      (selectedGateway === 'nagad' && paymentSettings.nagadQrUrl) ||
                      (selectedGateway === 'rocket' && paymentSettings.rocketQrUrl) ||
                      (selectedCustom && selectedCustom.imageUrl) ? (
                        <div
                          onClick={() => {
                            const img =
                              selectedGateway === 'bkash'
                                ? paymentSettings.bkashQrUrl
                                : selectedGateway === 'nagad'
                                ? paymentSettings.nagadQrUrl
                                : selectedGateway === 'rocket'
                                ? paymentSettings.rocketQrUrl
                                : selectedCustom?.imageUrl;
                            if (img) setPreviewImage(img);
                          }}
                          className="cursor-pointer group relative"
                          title="বড় করে দেখতে ক্লিক করুন"
                        >
                          <img
                            src={
                              selectedGateway === 'bkash'
                                ? paymentSettings.bkashQrUrl
                                : selectedGateway === 'nagad'
                                ? paymentSettings.nagadQrUrl
                                : selectedGateway === 'rocket'
                                ? paymentSettings.rocketQrUrl
                                : selectedCustom?.imageUrl
                            }
                            alt="Payment QR"
                            className="w-40 h-40 object-cover rounded-2xl border-2 border-amber-400/50 shadow-lg group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-opacity text-white text-xs font-bold">
                            🔍 বড় করে দেখুন
                          </div>
                        </div>
                      ) : (
                        <div className="w-36 h-36 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-slate-500 p-3">
                          <QrCode className="w-10 h-10 mb-2 opacity-50" />
                          <span className="text-[11px]">কোনো কিউআর বা ছবি নেই</span>
                          <span className="text-[9px] text-slate-600 mt-0.5">সরাসরি নাম্বারে সেন্ড মানি করুন</span>
                        </div>
                      )}
                      <span className="text-xs font-bold text-slate-300">
                        প্রদেয় পরিমাণ: <span className="text-emerald-400 font-black">৳{activeAmountBdt} BDT</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction ID Submission Form (for All Gateways) */}
              <form onSubmit={handleSubmitManual} className="pt-4 border-t border-[#172338] space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    📝 ট্রানজেকশন তথ্য পূরণ করুন (Submit Transaction Details)
                  </h4>
                  {selectedGateway === 'binance' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      ⚡ লাইভ অটো-ভেরিফাই সক্রিয়
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      {selectedGateway === 'binance' ? 'আপনার Binance Pay ID / UID:' : 'যে নাম্বার থেকে টাকা পাঠিয়েছেন (Sender Number):'}
                    </label>
                    <input
                      type="text"
                      value={senderIdentifier}
                      onChange={(e) => setSenderIdentifier(e.target.value)}
                      placeholder={selectedGateway === 'binance' ? 'e.g. 849201948' : 'e.g. 017XXXXXXXX'}
                      className="w-full bg-[#050912] border border-[#1b2b48] rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Transaction ID (TrxID):
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder={selectedGateway === 'binance' ? 'e.g. 239049281 বা On-chain Hash' : 'e.g. BLX9827361'}
                      className="w-full bg-[#050912] border border-[#1b2b48] rounded-xl p-2.5 text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                </div>

                {manualMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      manualMessage.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {manualMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{manualMessage.text}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingManual}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    {submittingManual ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>ডিপোজিট সাবমিট করুন (Submit Deposit)</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INSTANT TRANSACTION VERIFICATION TOOL */}
      {activeTab === 'verify' && (
        <div className="p-5 sm:p-7 rounded-3xl bg-[#0a101f] border border-[#1b2940] space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                স্বয়ংক্রিয় ট্রানজেকশন ভেরিফিকেশন (Instant Self-Verification)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ইতিমধ্যে আমাদের বাইন্যান্স একাউন্টে ডিপোজিট করেছেন? আপনার Transaction ID এখানে দিলে সার্ভার সরাসরি বাইন্যান্স যাচাই করে সাথে সাথে আপনার ওয়ালেটে ব্যালেন্স জমা করে দেবে!
              </p>
            </div>
          </div>

          <form onSubmit={handleInstantVerify} className="p-4 sm:p-5 rounded-2xl bg-[#060a13] border border-[#192740] space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                বাইনান্স Transaction ID (বা Order ID / Pay ID):
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={verifyTrxId}
                  onChange={(e) => setVerifyTrxId(e.target.value)}
                  placeholder="যেমন: P_A283918239 বা txId"
                  className="flex-1 bg-[#0b1324] border border-[#1e304f] rounded-xl p-3 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  required
                />
                <button
                  type="submit"
                  disabled={verifyingTrx}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition disabled:opacity-50"
                >
                  {verifyingTrx ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  <span>ভেরিফাই ও ব্যালেন্স জমা করুন</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                * টিপস: বাইন্যান্স অ্যাপের History বা Pay &gt; Transactions সেকশন থেকে Transaction ID কপি করে পেস্ট করুন।
              </p>
            </div>

            {verifyResult && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
                  verifyResult.success
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {verifyResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{verifyResult.message}</span>
              </div>
            )}
          </form>

          {/* Quick FAQ info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#090f1e] border border-slate-800 space-y-1">
              <span className="font-bold text-amber-400 block">⚡ তাৎক্ষণিক জমা</span>
              <p className="text-slate-400 text-[11px]">
                বাইনান্স পেমেন্ট এপিআই সরাসরি যুক্ত থাকায় কোনো এডমিন অনুমোদন ছাড়াই ব্যালেন্স ক্রেডিট হয়।
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#090f1e] border border-slate-800 space-y-1">
              <span className="font-bold text-amber-400 block">🔒 সুরক্ষিত ও নিরাপদ</span>
              <p className="text-slate-400 text-[11px]">
                প্রতিটি ট্রানজেকশন ইউনিকভাবে যাচাই করা হয়, ডাবল-স্পেন্ড বা জালিয়াতি প্রতিরোধ সম্পূর্ণ স্বয়ংক্রিয়।
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#090f1e] border border-slate-800 space-y-1">
              <span className="font-bold text-amber-400 block">📞 সাহায্য প্রয়োজন?</span>
              <p className="text-slate-400 text-[11px]">
                কোনো কারণে ট্রানজেকশন না পেলে আমাদের ২৪/৭ সাপোর্ট সেন্টারে যোগাযোগ করুন।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEPOSIT HISTORY */}
      {activeTab === 'history' && (
        <div className="p-4 sm:p-6 rounded-3xl bg-[#0a101f] border border-[#1b2940] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                আপনার ডিপোজিট হিস্ট্রি (Deposit History)
              </h3>
              <p className="text-xs text-slate-400">
                সকল পূর্ববর্তী ডিপোজিট ও ট্রানজেকশনের তালিকা নিচে দেওয়া হলো।
              </p>
            </div>
            <button
              type="button"
              onClick={fetchMyDeposits}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          {myDeposits.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-[#1b2b45] rounded-2xl">
              এখনও কোনো ডিপোজিট হিস্ট্রি নেই। উপরে প্যাকেজ সিলেক্ট করে প্রথম ডিপোজিট করুন!
            </div>
          ) : (
            <div className="space-y-2.5">
              {myDeposits.map((dep, idx) => {
                const isApproved = dep.status === 'approved' || dep.status === 'PAID';
                const isPending = dep.status === 'pending';
                return (
                  <div
                    key={dep.id || idx}
                    className="p-3.5 rounded-xl bg-[#070d18] border border-[#17243b] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isPending
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isApproved ? '✓' : isPending ? '⏳' : '✕'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">
                            ${Number(dep.amount || 0).toFixed(2)} USDT
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                            {dep.method || 'Deposit'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          TrxID: <span className="text-amber-400">{dep.transactionId || dep.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                      <span className="text-[10px] text-slate-500">
                        {dep.createdAt ? new Date(dep.createdAt).toLocaleString('bn-BD') : ''}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isPending
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isApproved ? 'সফল (Approved)' : isPending ? 'অপেক্ষমাণ (Pending)' : 'বাতিল (Rejected)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Large Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-sm w-full bg-[#0a101f] border border-amber-500/40 p-4 rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <img src={previewImage} alt="Payment Method" className="w-full h-auto rounded-2xl object-contain max-h-[70vh]" />
              <div className="text-center mt-3">
                <span className="text-xs font-bold text-amber-400">পেমেন্ট কিউআর কোড / ছবি</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration Modal on Successful Deposit */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full bg-gradient-to-b from-[#0e1b33] to-[#070b13] border-2 border-amber-400 p-6 rounded-3xl shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-emerald-400 text-slate-950 flex items-center justify-center mx-auto shadow-xl text-3xl font-black">
                🎉
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">ডিপোজিট সফল হয়েছে!</h3>
                <p className="text-xs text-emerald-400 font-bold">
                  অভিনন্দন! আপনার ওয়ালেটে ${creditedAmount} USDT জমা হয়েছে।
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#060a12] border border-slate-800 text-xs font-bold text-slate-300">
                নতুন ব্যালেন্স: <span className="text-amber-400 text-sm font-black">${Number(user?.balanceUsd || 0).toFixed(2)} USDT</span>
              </div>

              <button
                type="button"
                onClick={() => setShowCelebration(false)}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg cursor-pointer transition"
              >
                ঠিক আছে, ধন্যবাদ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
