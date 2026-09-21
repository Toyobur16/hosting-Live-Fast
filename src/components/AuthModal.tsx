import React, { useState, useEffect } from 'react';
import { Bot, User, Lock, Mail, Eye, EyeOff, CheckCircle2, AlertCircle, X, ExternalLink, RefreshCw, KeyRound, Sparkles, Gift, Phone, Smartphone, ShieldCheck } from 'lucide-react';
import { AuthUser } from '../types';
import { auth, googleProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: AuthUser, token: string) => void;
  canDismiss?: boolean;
  lang?: 'bn' | 'en';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  canDismiss = false,
  lang = 'bn'
}) => {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleInput, setShowGoogleInput] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');

  // Phone Auth states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const [rememberedEmail, setRememberedEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('bot_registered_email') || '';
    } catch {
      return '';
    }
  });

  const GOOGLE_CLIENT_ID =
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    '834197768303-oh9nrv1m59cmc2749uvjs6hrtfghh4n9.apps.googleusercontent.com';

  useEffect(() => {
    if (isOpen) {
      try {
        const savedEmail = localStorage.getItem('bot_registered_email') || '';
        if (savedEmail) {
          setRememberedEmail(savedEmail);
          setEmail((prev) => prev || savedEmail);
          setGoogleEmail((prev) => prev || savedEmail);
        }
      } catch {}
    }
  }, [isOpen]);

  useEffect(() => {
    // If Google Identity Services library is loaded, initialize for silent token acquisition
    if (isOpen && typeof window !== 'undefined') {
      const g = (window as any).google;
      if (g?.accounts?.id && GOOGLE_CLIENT_ID) {
        try {
          g.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });
        } catch (err) {
          console.warn('Google Sign-In initialization error', err);
        }
      }
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (phoneOtpCountdown > 0) {
      const timer = setTimeout(() => setPhoneOtpCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneOtpCountdown]);

  if (!isOpen) return null;

  const handleAuthenticateWithGoogleEmail = async (
    targetEmail: string,
    displayName?: string,
    picture?: string,
    googleId?: string
  ) => {
    const cleanMail = targetEmail.trim().toLowerCase();
    if (!cleanMail || !cleanMail.includes('@')) {
      setError(lang === 'bn' ? 'সঠিক গুগল ইমেইল এড্রেস লিখুন' : 'Please enter a valid Google email');
      setGoogleLoading(false);
      return;
    }

    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanMail,
          name: displayName || cleanMail.split('@')[0],
          picture: picture || '',
          googleId: googleId || `google_${Date.now()}`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (lang === 'bn' ? 'গুগল লগইন সম্পন্ন করা সম্ভব হয়নি' : 'Google login failed'));
      }
      localStorage.setItem('bot_auth_token', data.token);
      localStorage.setItem('bot_auth_user', JSON.stringify(data.user));
      localStorage.setItem('bot_registered_email', data.user.email);
      setRememberedEmail(data.user.email);
      onSuccess(data.user, data.token);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Google Sign-In error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'গুগল লগইন সম্পন্ন করা সম্ভব হয়নি');
      }
      localStorage.setItem('bot_auth_token', data.token);
      localStorage.setItem('bot_auth_user', JSON.stringify(data.user));
      localStorage.setItem('bot_registered_email', data.user.email);
      setRememberedEmail(data.user.email);
      onSuccess(data.user, data.token);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDirectGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);

    const emailToUse = (googleEmail.trim() || email.trim() || rememberedEmail.trim()).toLowerCase();

    // 1. Primary: Use Firebase official Google Auth Popup
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      if (fbUser && fbUser.email) {
        await handleAuthenticateWithGoogleEmail(
          fbUser.email,
          fbUser.displayName || undefined,
          fbUser.photoURL || undefined,
          fbUser.uid
        );
        return;
      }
    } catch (fbErr: any) {
      console.warn('Firebase popup sign-in note:', fbErr?.code || fbErr?.message);
    }

    try {
      const g = (window as any).google;

      // 2. Secondary fallback: Google Identity Services (GIS) Token Client
      if (g?.accounts?.oauth2 && GOOGLE_CLIENT_ID) {
        try {
          const client = g.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            callback: async (tokenResponse: any) => {
              if (tokenResponse?.error) {
                console.warn('Google popup status:', tokenResponse.error);
                if (emailToUse && emailToUse.includes('@')) {
                  await handleAuthenticateWithGoogleEmail(emailToUse);
                } else {
                  setShowGoogleInput(true);
                  setGoogleLoading(false);
                }
                return;
              }
              if (tokenResponse?.access_token) {
                try {
                  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                  });
                  const profile = await userInfoRes.json();
                  if (profile?.email) {
                    await handleAuthenticateWithGoogleEmail(
                      profile.email,
                      profile.name || profile.given_name,
                      profile.picture,
                      profile.sub
                    );
                    return;
                  }
                } catch {
                  if (emailToUse && emailToUse.includes('@')) {
                    await handleAuthenticateWithGoogleEmail(emailToUse);
                  } else {
                    setShowGoogleInput(true);
                  }
                } finally {
                  setGoogleLoading(false);
                }
              }
            }
          });
          client.requestAccessToken({ prompt: 'select_account' });
          return;
        } catch (err) {
          console.warn('Error launching Google GIS popup:', err);
        }
      }

      // 3. Fallback: Quick direct google email sign in
      if (emailToUse && emailToUse.includes('@')) {
        await handleAuthenticateWithGoogleEmail(emailToUse);
      } else {
        setShowGoogleInput(true);
        setGoogleLoading(false);
      }
    } catch {
      if (emailToUse && emailToUse.includes('@')) {
        await handleAuthenticateWithGoogleEmail(emailToUse);
      } else {
        setShowGoogleInput(true);
        setGoogleLoading(false);
      }
    }
  };

  const handleSendPhoneOtp = async () => {
    setError(null);
    setSuccessMessage(null);
    let rawPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    if (!rawPhone) {
      setError(lang === 'bn' ? 'সঠিক মোবাইল নম্বর লিখুন' : 'Please enter mobile number');
      return;
    }
    if (rawPhone.startsWith('01')) rawPhone = '+88' + rawPhone;
    else if (rawPhone.startsWith('8801')) rawPhone = '+' + rawPhone;
    else if (!rawPhone.startsWith('+')) rawPhone = '+' + rawPhone;

    if (rawPhone.length < 11) {
      setError(lang === 'bn' ? 'মোবাইল নম্বর কমপক্ষে ১১ সংখ্যার হতে হবে' : 'Mobile number must be at least 11 digits');
      return;
    }

    setPhoneLoading(true);

    // 1. Try Firebase Phone Auth (Sends real SMS via Google Firebase Phone Provider)
    try {
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch {}
        (window as any).recaptchaVerifier = undefined;
      }
      const container = document.getElementById('recaptcha-container');
      if (container) {
        const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {}
        });
        (window as any).recaptchaVerifier = recaptchaVerifier;
        const confirmation = await signInWithPhoneNumber(auth, rawPhone, recaptchaVerifier);
        setConfirmationResult(confirmation);
        setPhoneOtpSent(true);
        setPhoneOtpCountdown(60);
        setSuccessMessage(
          lang === 'bn'
            ? `আপনার মোবাইলে এসএমএস (SMS)-এর মাধ্যমে ওটিপি কোড পাঠানো হয়েছে: ${rawPhone}`
            : `SMS verification OTP sent to your phone: ${rawPhone}`
        );
        setPhoneLoading(false);
        return;
      }
    } catch (fbErr: any) {
      console.error('Firebase SMS verification error:', fbErr);
      let errorMsg = fbErr?.message || '';
      if (fbErr?.code === 'auth/quota-exceeded') {
        errorMsg = 'ফায়ারবেস এসএমএস কোটা শেষ হয়ে গেছে। অনুগ্রহ করে পরে চেষ্টা করুন।';
      } else if (fbErr?.code === 'auth/invalid-phone-number') {
        errorMsg = 'মোবাইল নম্বরটি সঠিক নয়। অনুগ্রহ করে সঠিক নম্বর দিন (যেমন: 01XXXXXXXXX)।';
      } else if (fbErr?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Firebase Console-এ Phone Authentication প্রোভাইডার সক্রিয় (Enable) করা নেই। অনুগ্রহ করে ফায়ারবেস অথেনটিকেশনে Phone Provider অন করুন।';
      } else if (fbErr?.code === 'auth/too-many-requests') {
        errorMsg = 'অতিরিক্ত ওটিপি রিকোয়েস্টের কারণে সাময়িক ব্লক করা হয়েছে। কিছুক্ষণ অপেক্ষা করে চেষ্টা করুন।';
      } else if (fbErr?.code === 'auth/captcha-check-failed') {
        errorMsg = 'reCAPTCHA যাচাই ব্যর্থ হয়েছে। পেইজটি রিফ্রেশ করে আবার চেষ্টা করুন।';
      } else {
        errorMsg = `অফিসিয়াল এসএমএস পাঠাতে ব্যর্থ: ${fbErr?.message || 'Firebase Phone Auth Error'}`;
      }
      setError(errorMsg);
      setPhoneLoading(false);
      return;
    }
  };

  const handleVerifyPhoneOtp = async () => {
    setError(null);
    setSuccessMessage(null);
    const rawCode = phoneOtp.trim();
    if (!rawCode || rawCode.length < 4) {
      setError(lang === 'bn' ? '৬-সংখ্যার ভেরিফিকেশন কোড লিখুন' : 'Please enter verification code');
      return;
    }

    setPhoneLoading(true);
    let firebaseUid = '';

    // If Firebase ConfirmationResult is present, confirm with Firebase
    if (confirmationResult) {
      try {
        const res = await confirmationResult.confirm(rawCode);
        if (res?.user?.uid) {
          firebaseUid = res.user.uid;
        }
      } catch (fbErr: any) {
        console.warn('Firebase confirm note:', fbErr?.message);
      }
    }

    let rawPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    if (rawPhone.startsWith('01')) rawPhone = '+88' + rawPhone;
    else if (rawPhone.startsWith('8801')) rawPhone = '+' + rawPhone;
    else if (!rawPhone.startsWith('+')) rawPhone = '+' + rawPhone;

    try {
      const res = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: rawPhone,
          code: rawCode,
          name: name.trim() || undefined,
          firebaseUid: firebaseUid || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (lang === 'bn' ? 'ভেরিফিকেশন কোড সঠিক নয়' : 'Invalid verification code'));
      }

      localStorage.setItem('bot_auth_token', data.token);
      localStorage.setItem('bot_auth_user', JSON.stringify(data.user));
      if (data.user.email) {
        localStorage.setItem('bot_registered_email', data.user.email);
        setRememberedEmail(data.user.email);
      }
      setSuccessMessage(data.message || (lang === 'bn' ? 'মোবাইল ভেরিফিকেশন সফল হয়েছে!' : 'Verification successful!'));
      onSuccess(data.user, data.token);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(lang === 'bn' ? 'সঠিক ইমেইল এড্রেস লিখুন' : 'Please enter a valid email address');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError(lang === 'bn' ? 'আপনার পুরো নাম লিখুন' : 'Please enter your full name');
        return;
      }
      if (password.length < 6) {
        setError(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError(lang === 'bn' ? 'দুইটি পাসওয়ার্ড মিলছে না! একই পাসওয়ার্ড দিন।' : 'Passwords do not match! Please enter identical passwords.');
        return;
      }
    }

    if (mode === 'login') {
      if (!password) {
        setError(lang === 'bn' ? 'পাসওয়ার্ড প্রদান করুন' : 'Please enter your password');
        return;
      }
    }

    if (mode === 'reset') {
      if (newPassword.length < 6) {
        setError(lang === 'bn' ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'New password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError(lang === 'bn' ? 'নতুন পাসওয়ার্ড দুটি মিলছে না!' : 'New passwords do not match!');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: cleanEmail, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || (lang === 'bn' ? 'রেজিস্ট্রেশন ব্যর্থ হয়েছে' : 'Registration failed'));
        }

        // Auto-login immediately upon registration so user doesn't have to fill forms again
        localStorage.setItem('bot_auth_token', data.token);
        localStorage.setItem('bot_auth_user', JSON.stringify(data.user));
        localStorage.setItem('bot_registered_email', data.user.email);
        setRememberedEmail(data.user.email);
        onSuccess(data.user, data.token);
        if (onClose) onClose();
      } else if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || (lang === 'bn' ? 'লগইন ব্যর্থ হয়েছে' : 'Login failed'));
        }
        localStorage.setItem('bot_auth_token', data.token);
        localStorage.setItem('bot_auth_user', JSON.stringify(data.user));
        localStorage.setItem('bot_registered_email', data.user.email);
        setRememberedEmail(data.user.email);
        onSuccess(data.user, data.token);
        if (onClose) onClose();
      } else if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, newPassword })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || (lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে' : 'Password reset failed'));
        }
        localStorage.setItem('bot_auth_token', data.token);
        localStorage.setItem('bot_auth_user', JSON.stringify(data.user));
        localStorage.setItem('bot_registered_email', data.user.email);
        setRememberedEmail(data.user.email);
        onSuccess(data.user, data.token);
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || 'ত্রুটি ঘটেছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050811]/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-[#1f2c42] shadow-2xl rounded-3xl max-w-[420px] w-full p-7 text-white relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-24 bg-gradient-to-b from-fuchsia-500/15 via-pink-500/10 to-transparent blur-2xl pointer-events-none" />

        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors z-10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-[#334155] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-pink-500/10 text-pink-400">
            <Bot className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {mode === 'login'
              ? (lang === 'bn' ? 'লগইন করুন' : 'Sign In')
              : mode === 'register'
              ? (lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Account')
              : (lang === 'bn' ? 'পাসওয়ার্ড রিসেট' : 'Reset Password')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? (lang === 'bn' ? 'আপনার অ্যাকাউন্ট এবং বট ম্যানেজ করতে লগইন করুন' : 'Welcome back to your bot cloud')
              : mode === 'register'
              ? (lang === 'bn' ? 'নতুন অ্যাকাউন্ট খুলে আনলিমিটেড বট হোস্ট করুন' : 'Join and host unlimited bots')
              : (lang === 'bn' ? 'আপনার নিবন্ধিত ইমেইল এবং নতুন পাসওয়ার্ড দিন' : 'Enter your registered email and new password')}
          </p>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* 1 Free Bot Banner for new users */}
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 border border-emerald-500/30 flex items-center gap-2.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Gift className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-300">
              {lang === 'bn' ? '🎉 ১টি টেলিগ্রাম বট সম্পূর্ণ ফ্রিতে লাইভ হোস্ট করুন!' : '🎉 Host 1 Telegram Bot 24/7 100% Free!'}
            </p>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
              {lang === 'bn' ? 'রেজিস্ট্রেশন করলেই বিনামূল্যে ১টি বট আজীবন লাইভ হোস্টিং করতে পারবেন।' : 'Instant registration includes 1 bot 24/7 free hosting.'}
            </p>
          </div>
        </div>

        {/* Method Switcher: Email/Google vs Mobile Number */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0b1220] rounded-2xl border border-[#1f2d48] mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('email');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMethod === 'email'
                ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-pink-400" />
            <span>{lang === 'bn' ? 'ইমেইল / গুগল' : 'Email / Google'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('phone');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMethod === 'phone'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'bn' ? '📱 মোবাইল নম্বর (OTP)' : '📱 Mobile Phone'}</span>
          </button>
        </div>

        {authMethod === 'phone' ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
            <div id="recaptcha-container"></div>

            {mode === 'register' && !phoneOtpSent && (
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'bn' ? 'আপনার পুরো নাম (ঐচ্ছিক)' : 'Full Name (Optional)'}
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-emerald-500 rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-4 text-xs focus:outline-none transition-all"
                />
              </div>
            )}

            {!phoneOtpSent ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'bn' ? 'মোবাইল নম্বর প্রদান করুন:' : 'Mobile Number:'}</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="px-3 py-3 rounded-xl bg-[#0b1220] border border-[#1f2d48] text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5 shrink-0 select-none shadow-sm">
                      <span>🇧🇩</span>
                      <span>+88</span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-emerald-500 rounded-xl text-white placeholder-slate-500 py-3 px-3.5 text-xs font-mono font-bold tracking-wide focus:outline-none transition-all"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl">
                  <p className="text-[11px] text-emerald-300 leading-relaxed flex items-start gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'bn'
                        ? 'আপনার মোবাইল নম্বরে একটি ৬-সংখ্যার গোপন ভেরিফিকেশন ওটিপি (OTP) কোড পাঠানো হবে।'
                        : 'A 6-digit confidential OTP verification code will be sent to your phone.'}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={phoneLoading || !phoneNumber.trim()}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                >
                  {phoneLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{lang === 'bn' ? 'ওটিপি (OTP) কোড পাঠান' : 'Send Verification OTP'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] text-emerald-400 font-semibold">{lang === 'bn' ? 'কোড পাঠানো হয়েছে' : 'Code Sent To'}</p>
                    <p className="text-xs font-mono font-bold text-white tracking-wide">{phoneNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneOtpSent(false);
                      setPhoneOtp('');
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
                    <span>{lang === 'bn' ? '৬-সংখ্যার ভেরিফিকেশন কোড লিখুন:' : 'Enter 6-Digit OTP Code:'}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full bg-[#0b1220] border-2 border-emerald-500/60 focus:border-emerald-400 rounded-xl text-white placeholder-slate-600 py-3 px-4 text-base font-mono tracking-widest text-center focus:outline-none transition-all font-black shadow-inner"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-400 text-[11px]">
                    {phoneOtpCountdown > 0
                      ? `${lang === 'bn' ? 'পুনরায় কোড পাঠানোর সময়:' : 'Resend code in:'} ${phoneOtpCountdown}s`
                      : ''}
                  </span>
                  <button
                    type="button"
                    disabled={phoneOtpCountdown > 0 || phoneLoading}
                    onClick={handleSendPhoneOtp}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {lang === 'bn' ? 'কোড পাননি? পুনরায় পাঠান' : 'Resend Code'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyPhoneOtp}
                  disabled={phoneLoading || phoneOtp.length < 4}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                >
                  {phoneLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {mode === 'register'
                      ? (lang === 'bn' ? 'ভেরিফাই ও অ্যাকাউন্ট তৈরি করুন' : 'Verify & Create Account')
                      : (lang === 'bn' ? 'ভেরিফাই ও লগইন করুন' : 'Verify & Sign In')}
                  </span>
                </button>
              </div>
            )}

            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-400">
                {lang === 'bn'
                  ? '🔒 মোবাইল নম্বর ভেরিফিকেশনের মাধ্যমে আপনার অ্যাকাউন্ট, বট ও ব্যালেন্স স্থায়ীভাবে সুরক্ষিত থাকে।'
                  : '🔒 Phone verification permanently secures your account, balance and bots.'}
              </p>
            </div>
          </div>
        ) : (
          <>
        {/* Quick Google Login for previously registered account */}
        {mode === 'login' && rememberedEmail && (
          <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/50 border border-blue-500/40 shadow-md">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{lang === 'bn' ? 'পূর্বে রেজিস্ট্রেশন করা অ্যাকাউন্ট:' : 'Previously Registered Account:'}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-medium border border-emerald-500/30">
                {lang === 'bn' ? 'সংযুক্ত' : 'Linked'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-[#0b1220]/80 p-2.5 rounded-xl border border-slate-800">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white font-medium truncate font-mono">{rememberedEmail}</p>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                  {lang === 'bn' ? 'গুগল দিয়ে ১-ক্লিকে আগের অ্যাকাউন্টে লগইন করুন' : '1-Click Google sign-in to this account'}
                </p>
              </div>
              <button
                type="button"
                disabled={googleLoading}
                onClick={() => handleAuthenticateWithGoogleEmail(rememberedEmail)}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 font-bold text-xs rounded-lg shadow transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {googleLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>{lang === 'bn' ? 'গুগল দিয়ে লগইন' : 'Google Login'}</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'bn' ? 'আপনার পুরো নাম (Full Name)' : 'Full Name'}
                className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-4 text-xs focus:outline-none transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={lang === 'bn' ? 'ইমেইল এড্রেস (Email Address)' : 'Email Address'}
              className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-4 text-xs focus:outline-none transition-all"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'register'
                      ? (lang === 'bn' ? 'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)' : 'Password (min 6 chars)')
                      : (lang === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Enter Password')
                  }
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'login' && (
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-pink-400 hover:text-pink-300 transition-colors cursor-pointer"
                  >
                    {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
                className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড লিখুন' : 'Enter New Password'}
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#d946ef] via-[#ec4899] to-[#f43f5e] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
            ) : mode === 'register' ? (
              <span>{lang === 'bn' ? 'এখনই রেজিস্ট্রেশন করুন' : 'Register Now'}</span>
            ) : (
              <span>{lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন ও লগইন' : 'Update Password & Sign In'}</span>
            )}
          </button>
        </form>

        <div className="text-center mt-5">
          {mode === 'login' ? (
            <p className="text-xs text-slate-400">
              {lang === 'bn' ? 'কোনো অ্যাকাউন্ট নেই?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccessMessage(null);
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer ml-1"
              >
                {lang === 'bn' ? 'নতুন অ্যাকাউন্ট খুলুন (Create Account Here)' : 'Create Account Here'}
              </button>
            </p>
          ) : mode === 'register' ? (
            <p className="text-xs text-slate-400">
              {lang === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer ml-1"
              >
                {lang === 'bn' ? 'লগইন করুন (Sign In Here)' : 'Sign In Here'}
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer"
              >
                {lang === 'bn' ? 'লগইনে ফিরে যান' : 'Back to Sign In'}
              </button>
            </p>
          )}
        </div>

        {/* Official Google Sign-In — placed directly under Create Account Here */}
        {mode !== 'reset' && (
          <div className="mt-5 pt-4 border-t border-[#1f2d48] space-y-3">
            <div className="relative flex py-0.5 items-center">
              <div className="flex-grow border-t border-[#1f2d48]"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-medium">
                {lang === 'bn' ? 'অথবা গুগল দিয়ে লগইন / সাইন-আপ করুন' : 'or continue with Google'}
              </span>
              <div className="flex-grow border-t border-[#1f2d48]"></div>
            </div>

            {showGoogleInput ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-b from-blue-950/40 to-slate-900 border border-blue-500/40 space-y-2.5 shadow-lg animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{lang === 'bn' ? 'গুগল অ্যাকাউন্ট ইমেইল লিখুন' : 'Enter your Google Email'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGoogleInput(false)}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAuthenticateWithGoogleEmail(googleEmail || email);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="email"
                    value={googleEmail || email}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="flex-1 bg-[#0b1220] border border-blue-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 font-medium"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={googleLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {googleLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>{lang === 'bn' ? 'প্রবেশ করুন' : 'Sign In'}</span>}
                  </button>
                </form>
                <p className="text-[10px] text-slate-400">
                  {lang === 'bn'
                    ? '💡 কোনো পাসওয়ার্ড লাগবে না — আপনার গুগল ইমেইল দিয়ে সরাসরি ইনস্ট্যান্ট লগইন হয়ে যাবে।'
                    : '💡 No password needed. Instant sign-in with your Google account.'}
                </p>
              </div>
            ) : (
              <button
                type="button"
                id="official-google-login-btn"
                onClick={handleDirectGoogleLogin}
                disabled={googleLoading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-[#3c4043] font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 border border-[#dadce0] group hover:shadow-lg"
              >
                {googleLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span className="text-[13px] font-medium text-slate-800">
                  {googleLoading
                    ? (lang === 'bn' ? 'গুগল দিয়ে লগইন হচ্ছে...' : 'Signing in with Google...')
                    : mode === 'register'
                    ? (lang === 'bn' ? 'Google দিয়ে একাউন্ট খুলুন' : 'Sign up with Google')
                    : (lang === 'bn' ? 'Google দিয়ে লগইন করুন' : 'Sign in with Google')}
                </span>
              </button>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};
