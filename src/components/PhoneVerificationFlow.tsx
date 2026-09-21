import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Phone,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { AuthUser } from '../types';
import {
  sendPhoneVerificationOtp,
  verifyPhoneOtpCode,
  formatPhoneNumber,
  cleanupRecaptcha
} from '../lib/phoneAuth';
import { ConfirmationResult } from '../lib/firebase';

interface PhoneVerificationFlowProps {
  currentUser?: AuthUser | null;
  onSuccess: (updatedUser: AuthUser, token?: string) => void;
  onClose?: () => void;
  lang?: 'bn' | 'en';
  title?: string;
  subtitle?: string;
  isModal?: boolean;
}

export const PhoneVerificationFlow: React.FC<PhoneVerificationFlowProps> = ({
  currentUser,
  onSuccess,
  onClose,
  lang = 'bn',
  title,
  subtitle,
  isModal = false
}) => {
  const [phoneNumber, setPhoneNumber] = useState(
    currentUser?.phoneNumber ? currentUser.phoneNumber.replace('+88', '') : ''
  );
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    return () => {
      cleanupRecaptcha();
    };
  }, []);

  const handleSendOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    const cleaned = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    if (!cleaned) {
      setError(lang === 'bn' ? 'সঠিক মোবাইল নম্বর লিখুন' : 'Please enter mobile number');
      return;
    }
    const formatted = formatPhoneNumber(cleaned);
    if (formatted.length < 11) {
      setError(lang === 'bn' ? 'মোবাইল নম্বর কমপক্ষে ১১ সংখ্যার হতে হবে' : 'Mobile number must be at least 11 digits');
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneVerificationOtp(formatted, 'phone-flow-recaptcha');
      if (result.confirmationResult) {
        setConfirmationResult(result.confirmationResult);
      }
      setOtpSent(true);
      setCountdown(60);
      setSuccessMsg(
        lang === 'bn'
          ? `ভেরিফিকেশন কোড পাঠানো হয়েছে ${result.phoneNumber} নম্বরে`
          : `Verification code sent to ${result.phoneNumber}`
      );
    } catch (err: any) {
      setError(err.message || 'OTP send failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setError(lang === 'bn' ? '৬-সংখ্যার ওটিপি কোড লিখুন' : 'Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyPhoneOtpCode({
        phoneNumber,
        code: cleanCode,
        confirmationResult,
        isLinking: !!currentUser
      });

      if (result.token) {
        localStorage.setItem('bot_auth_token', result.token);
      }
      if (result.user) {
        localStorage.setItem('bot_auth_user', JSON.stringify(result.user));
      }

      setSuccessMsg(
        lang === 'bn'
          ? '🎉 অভিনন্দন! আপনার মোবাইল নম্বর সফলভাবে ভেরিফাই সম্পন্ন হয়েছে।'
          : '🎉 Congratulations! Mobile number successfully verified.'
      );

      setTimeout(() => {
        onSuccess(result.user, result.token);
        if (onClose) onClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="space-y-4">
      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="phone-flow-recaptcha"></div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{title || (lang === 'bn' ? 'মোবাইল নম্বর ভেরিফিকেশন' : 'Mobile Number Verification')}</span>
            {currentUser?.phoneVerified && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                {lang === 'bn' ? 'ভেরিফাইড' : 'Verified'}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {subtitle || (
              lang === 'bn'
                ? 'আপনার একাউন্টের নিরাপত্তা ও বট হোস্টিং নিশ্চিত করতে মোবাইল নম্বর ভেরিফাই করুন।'
                : 'Verify your phone number to secure bots and account access.'
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {!otpSent ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'bn' ? 'মোবাইল নম্বর লিখুন:' : 'Enter Mobile Number:'}</span>
            </label>
            <div className="flex gap-2">
              <div className="px-3.5 py-3 rounded-xl bg-[#0b1220] border border-[#1f2d48] text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 select-none shadow-sm">
                <span>🇧🇩</span>
                <span>+88</span>
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-emerald-500 rounded-xl text-white placeholder-slate-500 py-3 px-3.5 text-xs font-mono font-bold tracking-wider focus:outline-none transition-all"
                autoFocus
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300/90 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {lang === 'bn'
                ? 'ফায়ারবেস অথেনটিকেশন ও ওটিপি (OTP) সার্ভিসের মাধ্যমে আপনার নম্বরে ৬-সংখ্যার এসএমএস কোড পাঠানো হবে।'
                : 'A 6-digit SMS verification OTP will be sent to your phone number via Firebase Authentication.'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={loading || !phoneNumber.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
            <span>{lang === 'bn' ? 'এসএমএস কোড (OTP) পাঠান' : 'Send SMS OTP Code'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] text-emerald-400 font-semibold">{lang === 'bn' ? 'কোড পাঠানো হয়েছে' : 'Code sent to'}</p>
              <p className="text-xs font-mono font-bold text-white tracking-wide">{formatPhoneNumber(phoneNumber)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtpCode('');
                setError(null);
              }}
              className="text-[11px] text-emerald-400 hover:underline cursor-pointer font-medium"
            >
              {lang === 'bn' ? 'নম্বর পরিবর্তন' : 'Change Number'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'bn' ? '৬-সংখ্যার ভেরিফিকেশন কোড লিখুন:' : 'Enter 6-Digit Verification Code:'}</span>
            </label>
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full bg-[#0b1220] border-2 border-emerald-500/60 focus:border-emerald-400 rounded-xl text-white placeholder-slate-600 py-3 px-4 text-base font-mono tracking-widest text-center focus:outline-none transition-all font-black shadow-inner"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 text-[11px]">
              {countdown > 0
                ? `${lang === 'bn' ? 'পুনরায় পাঠানো যাবে:' : 'Resend in:'} ${countdown}s`
                : ''}
            </span>
            <button
              type="button"
              disabled={countdown > 0 || loading}
              onClick={handleSendOtp}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {lang === 'bn' ? 'কোড পাননি? পুনরায় পাঠান' : 'Resend Code'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={loading || otpCode.length < 4}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{lang === 'bn' ? 'কোড যাচাই করুন ও ভেরিফাই সম্পন্ন করুন' : 'Verify Code & Complete'}</span>
          </button>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050811]/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-[#111927] border border-[#1f2c42] shadow-2xl rounded-3xl max-w-[420px] w-full p-6 text-white relative overflow-hidden">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0c1a2e] to-[#071322] border border-emerald-500/30 shadow-lg">
      {content}
    </div>
  );
};
