import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  ArrowLeft,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Send,
  Coins,
  Zap,
  Loader2,
  QrCode,
  Check,
  RefreshCw,
  X
} from 'lucide-react';
import { AuthUser, PaymentSettings, DepositRequest, BinancePayOrder } from '../types';

interface StoreWalletPageProps {
  user: AuthUser | null;
  onOpenAuthModal: () => void;
  onNavigateToPlans: () => void;
  onUserUpdated?: (updatedUser: AuthUser) => void;
}

export function StoreWalletPage({
  user,
  onOpenAuthModal,
  onNavigateToPlans,
  onUserUpdated
}: StoreWalletPageProps) {
  const [view, setView] = useState<'overview' | 'deposit'>('overview');
  const [activeHistoryTab, setActiveHistoryTab] = useState<'all' | 'deposits' | 'purchases'>('all');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    binanceUid: '922593999',
    binancePayId: '922593999',
    binanceId: '922593999',
    binanceEnabled: true,
    binancePayApiEnabled: true,
    bkashNumber: '01614572747',
    bkashEnabled: true,
    nagadNumber: '01304104492',
    nagadEnabled: true,
    rocketNumber: '01304104492',
    rocketEnabled: true
  });

  const [selectedGateway, setSelectedGateway] = useState<'binance' | 'bkash' | 'nagad' | 'rocket'>('binance');
  const [binanceMode, setBinanceMode] = useState<'automatic' | 'manual'>('automatic');
  const [depositAmount, setDepositAmount] = useState<string>('5');
  const [depositCurrency, setDepositCurrency] = useState<'USD' | 'BDT'>('USD');
  const [senderIdentifier, setSenderIdentifier] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [depositNote, setDepositNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Instant Binance Pay State
  const [binanceLoading, setBinanceLoading] = useState(false);
  const [activeBinanceOrder, setActiveBinanceOrder] = useState<BinancePayOrder | null>(null);
  const [binancePaymentPaid, setBinancePaymentPaid] = useState(false);
  const [checkingBinanceStatus, setCheckingBinanceStatus] = useState(false);
  const [returnSuccessMessage, setReturnSuccessMessage] = useState<string | null>(null);
  const [modalTrxId, setModalTrxId] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalSuccessMsg, setModalSuccessMsg] = useState<string | null>(null);
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);

  const [userRequests, setUserRequests] = useState<DepositRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const BDT_RATE = 120; // 1 USDT = 120 BDT
  const PRESET_AMOUNTS = [1, 2, 5, 10, 20, 50, 100];

  useEffect(() => {
    fetchPaymentSettings();
    if (user) fetchUserRequests();
  }, [user]);

  // Check URL params from Binance Pay redirect: ?deposit=success&orderId=...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const depositStatus = params.get('deposit');
    const orderId = params.get('orderId');

    if (depositStatus && orderId) {
      handleCheckReturnOrder(orderId);
      // Clean up URL query parameters without reloading
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  // Poll for Binance Pay status when modal is open and pending
  useEffect(() => {
    if (!activeBinanceOrder || activeBinanceOrder.status === 'PAID') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/binance-pay/check-status/${activeBinanceOrder.orderId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'PAID') {
            setActiveBinanceOrder((prev) => (prev ? { ...prev, status: 'PAID' } : null));
            setBinancePaymentPaid(true);
            refreshUserData();
            fetchUserRequests();
            clearInterval(interval);
          }
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [activeBinanceOrder]);

  const refreshUserData = async () => {
    const token = localStorage.getItem('bot_auth_token');
    if (!token) return;
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
    } catch {}
  };

  const handleCheckReturnOrder = async (orderId: string) => {
    try {
      setCheckingBinanceStatus(true);
      const res = await fetch(`/api/binance-pay/check-status/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'PAID') {
          setReturnSuccessMessage(`🎉 অভিনন্দন! $${data.amount} USDT পেমেন্ট সফল হয়েছে এবং ওয়ালেটে যোগ করা হয়েছে!`);
          refreshUserData();
          fetchUserRequests();
        }
      }
    } catch {} finally {
      setCheckingBinanceStatus(false);
    }
  };

  const handleInitiateBinancePay = async () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }

    const amt = parseFloat(depositAmount);
    if (!amt || amt < 0.1) {
      setSubmitError('সর্বনিম্ন ডিপোজিট পরিমাণ $0.10 USDT (Minimum amount is $0.10)');
      return;
    }

    const token = localStorage.getItem('bot_auth_token');
    try {
      setBinanceLoading(true);
      setSubmitError(null);
      setBinancePaymentPaid(false);

      const res = await fetch('/api/binance-pay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: amt })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.configured === false) {
          setSubmitError('Binance Pay API কী এখনও কনফিগার করা হয়নি। আপনি নিচের ম্যানুয়াল ফর্ম দিয়ে ডিপোজিট করতে পারেন অথবা এডমিন প্যানেলে API কী সেট করুন।');
          setBinanceMode('manual');
        } else {
          setSubmitError(data.error || 'Binance Pay অর্ডার তৈরি করতে ব্যর্থ হয়েছে');
        }
        return;
      }

      setActiveBinanceOrder(data.order);
      setModalTrxId('');
      setModalSuccessMsg(null);
      setModalErrorMsg(null);

      // Open checkout URL in a new window or tab if automated checkout is active
      if (data.order.checkoutUrl && !data.order.isDirectMode) {
        window.open(data.order.checkoutUrl, '_blank');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Network error');
    } finally {
      setBinanceLoading(false);
    }
  };

  const handleModalSubmitTrx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBinanceOrder || !user) return;
    if (!modalTrxId.trim()) {
      setModalErrorMsg('Transaction ID বা Order ID লিখুন');
      return;
    }
    try {
      setModalSubmitting(true);
      setModalErrorMsg(null);
      const token = localStorage.getItem('bot_auth_token');
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: activeBinanceOrder.amount,
          currency: 'USD',
          method: 'binance',
          senderIdentifier: user.name || user.email || 'Binance User',
          transactionId: modalTrxId.trim(),
          note: `Binance Pay Order #${activeBinanceOrder.orderId}`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalErrorMsg(data.error || 'সাবমিট ব্যর্থ হয়েছে');
        return;
      }
      setModalSuccessMsg('🎉 ডিপোজিট তথ্য সফলভাবে জমা দেওয়া হয়েছে! এডমিন দ্রুত ভেরিফাই করে ব্যালেন্স যোগ করবেন।');
      setModalTrxId('');
      fetchUserRequests();
      refreshUserData();
      setTimeout(() => {
        setActiveBinanceOrder(null);
        setModalSuccessMsg(null);
      }, 3500);
    } catch (err: any) {
      setModalErrorMsg(err.message || 'Error occurred');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleManualCheckBinanceOrder = async () => {
    if (!activeBinanceOrder) return;
    try {
      setCheckingBinanceStatus(true);
      const res = await fetch(`/api/binance-pay/check-status/${activeBinanceOrder.orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'PAID') {
          setActiveBinanceOrder((prev) => (prev ? { ...prev, status: 'PAID' } : null));
          setBinancePaymentPaid(true);
          refreshUserData();
          fetchUserRequests();
        } else {
          setSubmitError('পেমেন্ট এখনও অনুমোদনের অপেক্ষায় আছে। বাইন্যান্সে কনফার্ম করে কয়েক সেকেন্ড পর আবার চেক করুন।');
          setTimeout(() => setSubmitError(null), 4000);
        }
      }
    } catch (err: any) {
      setSubmitError('স্ট্যাটাস চেক ব্যর্থ হয়েছে: ' + (err.message || 'Network error'));
    } finally {
      setCheckingBinanceStatus(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      const res = await fetch('/api/settings/payment');
      if (res.ok) {
        const data = await res.json();
        setPaymentSettings(data);
      }
    } catch {}
  };

  const fetchUserRequests = async () => {
    const token = localStorage.getItem('bot_auth_token');
    if (!token) return;
    try {
      setLoadingRequests(true);
      const res = await fetch('/api/wallet/my-deposits', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserRequests(data.deposits || []);
      }
    } catch {} finally {
      setLoadingRequests(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuthModal();
      return;
    }

    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) {
      setSubmitError('অনুগ্রহ করে সঠিক পরিমাণ লিখুন (Enter a valid amount)');
      return;
    }

    if (!transactionId.trim()) {
      setSubmitError('Transaction ID (TrxID) দেওয়া আবশ্যক');
      return;
    }

    if (!senderIdentifier.trim()) {
      setSubmitError(selectedGateway === 'binance' ? 'আপনার Binance Pay ID / UID লিখুন' : 'প্রেরক ফোন নাম্বার লিখুন');
      return;
    }

    const token = localStorage.getItem('bot_auth_token');
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amt,
          currency: 'USD',
          method: selectedGateway,
          senderIdentifier: senderIdentifier.trim(),
          transactionId: transactionId.trim(),
          note: depositNote.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'ডিপোজিট রিকোয়েস্ট ব্যর্থ হয়েছে');
        return;
      }

      setSubmitSuccess('🎉 আপনার ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন যাচাই করে দ্রুত ব্যালেন্স যুক্ত করবেন।');
      setTransactionId('');
      setSenderIdentifier('');
      setDepositNote('');
      fetchUserRequests();

      setTimeout(() => {
        setSubmitSuccess(null);
        setView('overview');
      }, 3500);
    } catch (err: any) {
      setSubmitError(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered transactions
  const filteredRequests = userRequests.filter((r) => {
    if (activeHistoryTab === 'deposits') return r.status === 'approved' || r.status === 'pending';
    if (activeHistoryTab === 'purchases') return false;
    return true;
  });

  const getGatewayNumber = () => {
    if (selectedGateway === 'binance') return paymentSettings.binancePayId || paymentSettings.binanceUid || paymentSettings.binanceId || '922593999';
    if (selectedGateway === 'bkash') return paymentSettings.bkashNumber || '01614572747';
    if (selectedGateway === 'nagad') return paymentSettings.nagadNumber || '01304104492';
    if (selectedGateway === 'rocket') return paymentSettings.rocketNumber || '01304104492';
    return '';
  };

  const getGatewayTitle = () => {
    if (selectedGateway === 'binance') return 'Binance (USDT)';
    if (selectedGateway === 'bkash') return 'bKash (বিকাশ)';
    if (selectedGateway === 'nagad') return 'Nagad (নগদ)';
    if (selectedGateway === 'rocket') return 'Rocket (রকেট)';
    return '';
  };

  const calculatedBdt = (parseFloat(depositAmount) || 0) * BDT_RATE;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 animate-in fade-in duration-200 px-2 sm:px-4">
      {view === 'overview' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00d293]/15 flex items-center justify-center text-[#00d293]">
                <Wallet className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                My Wallet
              </h2>
            </div>
            {user && (
              <button
                onClick={onNavigateToPlans}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                👑 হোস্টিং প্লান দেখুন
              </button>
            )}
          </div>

          {/* Gradient Balance Card strictly in USDT */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#00d293]/20 via-[#0d1c2e] to-[#070e18] border border-[#00d293]/30 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Current Balance
                </span>
                <div className="flex items-baseline gap-2.5 mt-1.5">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                    ${(user?.balanceUsd || 0).toFixed(2)}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-[#00d293] px-2.5 py-1 rounded-lg bg-[#00d293]/15 uppercase tracking-wider">
                    USDT
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  এই ব্যালেন্স দিয়ে যেকোনো বট ফাইল, স্ক্রিপ্ট ও হোস্টিং প্লান কিনতে পারবেন।
                </p>
              </div>

              {/* + Deposit Pill Button */}
              <div>
                <button
                  id="wallet-open-deposit-btn"
                  onClick={() => {
                    if (!user) onOpenAuthModal();
                    else setView('deposit');
                  }}
                  className="px-6 py-3 rounded-full bg-[#00d293] hover:bg-[#00be84] text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-[#00d293]/30 cursor-pointer transition-all hover:scale-105 active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Deposit USDT</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Tabs: All | Deposits | Purchases */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#162035] pb-2">
              <button
                onClick={() => setActiveHistoryTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeHistoryTab === 'all'
                    ? 'bg-[#00d293] text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Transactions
              </button>
              <button
                onClick={() => setActiveHistoryTab('deposits')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeHistoryTab === 'deposits'
                    ? 'bg-[#00d293] text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Deposits
              </button>
              <button
                onClick={() => setActiveHistoryTab('purchases')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeHistoryTab === 'purchases'
                    ? 'bg-[#00d293] text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Purchases
              </button>
            </div>

            {/* List */}
            {loadingRequests ? (
              <div className="p-8 text-center text-slate-400 text-xs">লোড হচ্ছে...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#0d1424] border border-[#1e2e42] text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">কোনো ডিপোজিট বা ট্রানজেকশন হিস্ট্রি নেই।</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-[#0f172a] border border-[#1e293b] flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : req.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {req.status === 'approved' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : req.status === 'rejected' ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="uppercase">{req.method} Deposit</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : req.status === 'rejected'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          TrxID: {req.transactionId} • {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-[#00d293]">
                        +${Number(req.amount || 0).toFixed(2)} USDT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Deposit Money View */
        <div className="space-y-6">
          {/* Back to Wallet Button */}
          <button
            onClick={() => setView('overview')}
            className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-[#00d293] cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Wallet</span>
          </button>

          {/* Return Success Notification from Binance redirect */}
          {returnSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{returnSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setReturnSuccessMessage(null)}
                className="text-emerald-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00d293]/15 flex items-center justify-center text-[#00d293]">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              ডিপোজিট মেথড নির্বাচন করুন
            </h2>
          </div>

          {/* All 4 Payment Gateways Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* 1. Binance */}
            <button
              type="button"
              onClick={() => {
                setSelectedGateway('binance');
                setBinanceMode('automatic');
              }}
              className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                selectedGateway === 'binance'
                  ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/30 shadow-lg'
                  : 'bg-[#0d1424] border-[#1e2e42] hover:border-amber-400/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center font-black text-sm">
                  ₮
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black text-white block truncate">Binance Pay</span>
                  <span className="text-[10px] text-amber-400 font-bold truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ইনস্ট্যান্ট অটো-অ্যাড
                  </span>
                </div>
              </div>
            </button>

            {/* 2. bKash */}
            <button
              type="button"
              onClick={() => setSelectedGateway('bkash')}
              className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                selectedGateway === 'bkash'
                  ? 'bg-pink-500/15 border-pink-500 ring-2 ring-pink-500/30 shadow-lg'
                  : 'bg-[#0d1424] border-[#1e2e42] hover:border-pink-500/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center font-black text-xs">
                  বিকাশ
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black text-white block truncate">bKash</span>
                  <span className="text-[10px] text-pink-400 font-bold truncate">Send Money</span>
                </div>
              </div>
            </button>

            {/* 3. Nagad */}
            <button
              type="button"
              onClick={() => setSelectedGateway('nagad')}
              className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                selectedGateway === 'nagad'
                  ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-500/30 shadow-lg'
                  : 'bg-[#0d1424] border-[#1e2e42] hover:border-orange-500/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs">
                  নগদ
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black text-white block truncate">Nagad</span>
                  <span className="text-[10px] text-orange-400 font-bold truncate">Send Money</span>
                </div>
              </div>
            </button>

            {/* 4. Rocket */}
            <button
              type="button"
              onClick={() => setSelectedGateway('rocket')}
              className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                selectedGateway === 'rocket'
                  ? 'bg-purple-500/15 border-purple-500 ring-2 ring-purple-500/30 shadow-lg'
                  : 'bg-[#0d1424] border-[#1e2e42] hover:border-purple-500/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-black text-xs">
                  রকেট
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black text-white block truncate">Rocket</span>
                  <span className="text-[10px] text-purple-400 font-bold truncate">Send Money</span>
                </div>
              </div>
            </button>
          </div>

          {/* Amount Preset Chips and Input */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0d1424] border border-[#1e2e42] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>💰</span> ডিপোজিট এমাউন্ট সিলেক্ট করুন (Select Amount):
              </label>
              {selectedGateway !== 'binance' && (
                <span className="text-[11px] font-bold text-amber-400">
                  ১ USDT = ১২০ ৳ (BDT)
                </span>
              )}
            </div>

            {/* Preset Amount Chips */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = parseFloat(depositAmount) === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(String(amt))}
                    className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 ring-2 ring-amber-400/50 shadow-md scale-[1.02]'
                        : 'bg-[#0a0f1d] hover:bg-[#141e33] text-slate-300 border border-slate-800'
                    }`}
                  >
                    ${amt}
                  </button>
                );
              })}
            </div>

            {/* Custom Amount Field */}
            <div className="pt-1 flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-amber-400">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={depositAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="w-full pl-8 pr-16 py-2 rounded-xl bg-[#0a0f1d] border border-slate-700 text-sm font-black text-white focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  USDT
                </span>
              </div>
              {selectedGateway !== 'binance' && (
                <div className="px-3.5 py-2 rounded-xl bg-[#070b14] border border-slate-800 text-xs font-bold text-slate-300 shrink-0">
                  মোট: <span className="text-amber-400 font-mono font-black">{calculatedBdt} ৳</span>
                </div>
              )}
            </div>
          </div>

          {/* AUTOMATED INSTANT BINANCE PAY VIEW */}
          {selectedGateway === 'binance' && binanceMode === 'automatic' ? (
            <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-amber-500/10 via-[#0d1424] to-[#070b14] border border-amber-500/30 shadow-2xl space-y-5">
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-400 flex items-center justify-center font-black text-lg">
                    ₮
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">⚡ Binance Pay ইনস্ট্যান্ট ডিপোজিট</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black">
                        অটোমেটিক ব্যালেন্স অ্যাড
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ডিপোজিট বাটনে ক্লিক করলে সরাসরি Binance এ নিয়ে যাবে এবং কনফার্ম করলে সাথে সাথে ব্যালেন্স যোগ হবে।
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#090e18] border border-amber-500/20">
                  <span className="text-[11px] font-bold text-slate-400 block">নির্বাচিত পরিমাণ</span>
                  <span className="text-xl font-black text-amber-400 mt-0.5 block font-mono">
                    ${parseFloat(depositAmount) || 0} USDT
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#090e18] border border-amber-500/20">
                  <span className="text-[11px] font-bold text-slate-400 block">নেটওয়ার্ক/গেটওয়ে ফি</span>
                  <span className="text-xl font-black text-emerald-400 mt-0.5 block font-mono">
                    $0.00 (ফ্রি)
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#090e18] border border-amber-500/20">
                  <span className="text-[11px] font-bold text-slate-400 block">ওয়ালেটে জমা হবে</span>
                  <span className="text-xl font-black text-white mt-0.5 block font-mono">
                    ${parseFloat(depositAmount) || 0} USDT
                  </span>
                </div>
              </div>

              {/* Steps Guide */}
              <div className="p-4 rounded-2xl bg-[#070b14] border border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">১</span>
                  <p>
                    নিচের <strong className="text-amber-400">"Binance Pay দিয়ে ডিপোজিট করুন"</strong> বাটনে ক্লিক করলে সরাসরি সুরক্ষিত Binance Pay পেমেন্ট গেটওয়েতে নিয়ে যাবে।
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">২</span>
                  <p>
                    আপনার Binance মোবাইল অ্যাপ দিয়ে QR কোড স্ক্যান করে অথবা ব্রাউজারে লগইন করে পেমেন্ট কনফার্ম করুন।
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">৩</span>
                  <p>
                    পেমেন্ট কনফার্ম করার সাথে সাথে <strong className="text-emerald-400">অটোমেটিক ইনস্ট্যান্টলি</strong> আপনার অ্যাকাউন্টে ব্যালেন্স যোগ হয়ে যাবে!
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleInitiateBinancePay}
                disabled={binanceLoading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:opacity-95 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {binanceLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Binance Pay ওপেন হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-slate-950" />
                    <span>${parseFloat(depositAmount) || 0} USDT ডিপোজিট করুন (ডাইরেক্ট Binance Pay)</span>
                  </>
                )}
              </button>

              {/* Switch to manual deposit */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setBinanceMode('manual')}
                  className="text-xs text-slate-400 hover:text-amber-400 underline cursor-pointer transition-colors"
                >
                  ম্যানুয়ালি Binance Pay ID / UID তে টাকা পাঠাতে চান? (ম্যানুয়াল ডিপোজিট ফর্ম)
                </button>
              </div>
            </div>
          ) : (
            /* MANUAL SUBMISSION FORM (for bKash, Nagad, Rocket, or manual Binance) */
            <div className="p-5 sm:p-7 rounded-3xl bg-[#0d1424] border border-[#1e2e42] shadow-xl space-y-5">
              {selectedGateway === 'binance' && (
                <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-between gap-2 text-xs text-amber-300">
                  <span>⚡ সরাসরি অটোমেটিক গেটওয়ে ব্যবহার করে ইনস্ট্যান্ট ব্যালেন্স যোগ করতে চান?</span>
                  <button
                    type="button"
                    onClick={() => setBinanceMode('automatic')}
                    className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs cursor-pointer hover:bg-amber-300 shrink-0"
                  >
                    ইনস্ট্যান্ট গেটওয়েতে যান
                  </button>
                </div>
              )}

              {/* Step-by-Step Payment Instructions */}
              <div className="p-4 rounded-2xl bg-[#070b14] border border-[#1e293b] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>💎</span> {getGatewayTitle()} ডিপোজিট নির্দেশিকা
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00d293]/20 text-[#00d293] font-bold">
                    {selectedGateway === 'binance' ? 'USDT' : '১ USDT = ১২০ টাকা'}
                  </span>
                </div>

                {/* Admin Number / Pay ID with 1-click Copy */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0f172a] border border-slate-700">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[11px] font-bold text-slate-300">
                      {selectedGateway === 'binance'
                        ? 'এডমিন Binance Pay ID / UID:'
                        : `এডমিন ${getGatewayTitle()} পার্সোনাল নাম্বার (Send Money):`}
                    </span>
                    <span className="text-base sm:text-lg font-black text-white tracking-wider mt-0.5 font-mono truncate">
                      {getGatewayNumber()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(getGatewayNumber(), 'gatewayNumber')}
                    className="px-3.5 py-2 rounded-xl bg-[#00d293] hover:bg-[#00be84] text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedField === 'gatewayNumber' ? '✓ কপি হয়েছে!' : 'কপি করুন'}</span>
                  </button>
                </div>

                {/* Sequential Steps Instructions */}
                <div className="p-3.5 rounded-xl bg-[#0a0f1d] border border-slate-800 space-y-2 text-xs leading-relaxed text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">
                      ১
                    </span>
                    <p>
                      উপরের এডমিনের{' '}
                      <strong className="text-white">
                        {selectedGateway === 'binance' ? 'Binance Pay ID / UID' : `${getGatewayTitle()} নাম্বার`}
                      </strong>{' '}
                      কপি করে আপনার {getGatewayTitle()} একাউন্ট থেকে টাকা/ডলার পাঠান।
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">
                      ২
                    </span>
                    <p>
                      পাঠানোর পর মেসেজ বা অ্যাপ থেকে প্রাপ্ত{' '}
                      <strong className="text-white">Transaction ID (TrxID)</strong> কপি করুন।
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-black text-[11px] shrink-0 mt-0.5">
                      ৩
                    </span>
                    <p>
                      নিচের বক্সে আপনার প্রেরক নাম্বার ও TrxID লিখে{' '}
                      <strong className="text-[#00d293]">ডিপোজিট সাবমিট করুন</strong>। এডমিন যাচাই করে দ্রুত
                      ব্যালেন্স যুক্ত করবেন।
                    </p>
                  </div>
                </div>
              </div>

              {/* Submission Form */}
              <form onSubmit={handleSubmitDeposit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    ১.{' '}
                    {selectedGateway === 'binance'
                      ? 'আপনার Binance UID / Pay ID (প্রেরক আইডি) *'
                      : `আপনার ${getGatewayTitle()} প্রেরক নাম্বার (যে নাম্বার থেকে পাঠিয়েছেন) *`}
                  </label>
                  <input
                    type="text"
                    required
                    value={senderIdentifier}
                    onChange={(e) => setSenderIdentifier(e.target.value)}
                    placeholder={
                      selectedGateway === 'binance'
                        ? 'e.g. 922593999 (Binance UID)'
                        : 'e.g. 017XXXXXXXX'
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0f172a] border border-[#1e293b] text-sm text-white font-bold focus:border-[#00d293] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    ২. {getGatewayTitle()} Transaction ID (TrxID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. 9J83KLOP01"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0f172a] border border-[#1e293b] text-sm text-white font-bold uppercase tracking-wider focus:border-[#00d293] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    ৩. অতিরিক্ত তথ্য বা নোট (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    placeholder="কোনো বিশেষ মন্তব্য থাকলে লিখতে পারেন"
                    className="w-full px-4 py-2 rounded-xl bg-[#0f172a] border border-[#1e293b] text-xs text-white focus:border-[#00d293] focus:outline-hidden"
                  />
                </div>

                {submitError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {submitSuccess && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{submitSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00d293] to-emerald-400 hover:from-[#00be84] hover:to-emerald-500 text-slate-950 font-black text-sm shadow-xl shadow-[#00d293]/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>{submitting ? 'সাবমিট হচ্ছে...' : 'ডিপোজিট রিকোয়েস্ট সাবমিট করুন'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE BINANCE ORDER CHECKOUT MODAL */}
      {activeBinanceOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0c1220] border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center font-black text-sm">
                  ₮
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Binance Pay Checkout</h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Order: #{activeBinanceOrder.orderId.substring(4, 14)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveBinanceOrder(null);
                  setBinancePaymentPaid(false);
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success State */}
            {binancePaymentPaid || activeBinanceOrder.status === 'PAID' ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40 flex items-center justify-center mx-auto animate-bounce">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">পেমেন্ট সফল হয়েছে!</h3>
                  <p className="text-xs text-emerald-400 font-bold mt-1">
                    ${activeBinanceOrder.amount} USDT আপনার ওয়ালেটে সাথে সাথে যুক্ত হয়েছে।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBinanceOrder(null);
                    setBinancePaymentPaid(false);
                    setView('overview');
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg transition-all"
                >
                  ওয়ালেট ব্যালেন্স দেখুন
                </button>
              </div>
            ) : (
              /* Pending Payment State */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#070b14] border border-amber-500/30 text-center space-y-1">
                  <span className="text-xs font-bold text-slate-400">পরিশোধযোগ্য পরিমাণ:</span>
                  <div className="text-2xl font-black text-amber-400 font-mono flex items-center justify-center gap-2">
                    <span>${activeBinanceOrder.amount} USDT</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`${activeBinanceOrder.amount}`, 'modal_amt')}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 font-bold hover:bg-amber-400/30 cursor-pointer"
                    >
                      {copiedField === 'modal_amt' ? '✓ কপি!' : 'কপি'}
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-amber-300 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>
                      {activeBinanceOrder.isDirectMode
                        ? 'Binance Pay ID তে সেন্ড করুন অথবা QR স্ক্যান করুন'
                        : 'পেমেন্ট অনুমোদনের অপেক্ষা করা হচ্ছে...'}
                    </span>
                  </div>
                </div>

                {/* Direct Pay Info Box */}
                {activeBinanceOrder.isDirectMode && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-bold">Binance Pay ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-amber-400 text-sm">
                          {activeBinanceOrder.binancePayId || '922593999'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeBinanceOrder.binancePayId || '922593999', 'modal_payid')}
                          className="px-2 py-0.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold text-[10px] cursor-pointer"
                        >
                          {copiedField === 'modal_payid' ? '✓ কপি!' : 'কপি'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Button */}
                <a
                  href={activeBinanceOrder.deeplink || activeBinanceOrder.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:opacity-95 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-all text-center"
                >
                  <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {activeBinanceOrder.isDirectMode ? 'Binance অ্যাপে ওপেন করুন' : 'সরাসরি Binance Pay তে যান'}
                  </span>
                </a>

                {/* QR Code for Binance mobile app scanning */}
                <div className="p-2.5 bg-white rounded-2xl mx-auto w-40 h-40 flex items-center justify-center shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      activeBinanceOrder.checkoutUrl || activeBinanceOrder.qrContent || ''
                    )}`}
                    alt="Binance Pay QR Code"
                    className="w-36 h-36 object-contain"
                  />
                </div>
                <p className="text-[11px] text-center text-slate-400">
                  Binance মোবাইল অ্যাপ দিয়ে উপরের QR কোডটি স্ক্যান করেও পে করতে পারেন।
                </p>

                {/* Direct Pay: Instant TrxID Submission Form */}
                {activeBinanceOrder.isDirectMode ? (
                  <form onSubmit={handleModalSubmitTrx} className="space-y-2 pt-1 border-t border-slate-800">
                    <label className="block text-[11px] font-bold text-slate-300">
                      পেমেন্ট শেষ হলে Binance Order ID / TrxID দিন:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={modalTrxId}
                        onChange={(e) => setModalTrxId(e.target.value)}
                        placeholder="e.g. 2938491829..."
                        className="flex-1 bg-[#070b14] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={modalSubmitting || !modalTrxId.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-40 transition-all shrink-0"
                      >
                        {modalSubmitting ? '...' : 'কনফার্ম'}
                      </button>
                    </div>

                    {modalErrorMsg && (
                      <p className="text-[11px] text-rose-400 font-bold">{modalErrorMsg}</p>
                    )}
                    {modalSuccessMsg && (
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{modalSuccessMsg}</span>
                      </div>
                    )}
                  </form>
                ) : (
                  /* Automated Check Status button */
                  <button
                    type="button"
                    onClick={handleManualCheckBinanceOrder}
                    disabled={checkingBinanceStatus}
                    className="w-full py-2.5 rounded-xl bg-[#141e33] hover:bg-[#1a2742] border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingBinanceStatus ? 'animate-spin' : ''}`} />
                    <span>{checkingBinanceStatus ? 'যাচাই করা হচ্ছে...' : 'আমি পেমেন্ট করেছি, চেক করুন (Verify Now)'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
