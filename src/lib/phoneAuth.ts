// Firebase Phone Auth Verification Helper
// Provides reCAPTCHA verifier and phone number verification flow
import {
  auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult
} from './firebase';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    recaptchaWidgetId?: number;
  }
}

/**
 * Standardize Bangladeshi and International phone numbers to E.164 format (+8801XXXXXXXXX)
 */
export function formatPhoneNumber(raw: string): string {
  let cleaned = String(raw || '').trim().replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('01')) {
    cleaned = '+88' + cleaned;
  } else if (cleaned.startsWith('8801')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+') && cleaned.length >= 10) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

/**
 * Clean up existing reCAPTCHA instance if needed
 */
export function cleanupRecaptcha() {
  try {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
    }
  } catch (err) {
    console.warn('Recaptcha cleanup error:', err);
  }
}

/**
 * Send real SMS verification OTP code to the user's mobile number via Firebase Phone Auth,
 * with fallback to server SMS OTP service.
 */
export async function sendPhoneVerificationOtp(
  phoneNumber: string,
  containerId: string = 'recaptcha-container'
): Promise<{
  confirmationResult?: ConfirmationResult;
  provider: 'firebase' | 'server';
  phoneNumber: string;
  codeHint?: string;
  message: string;
}> {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone || formattedPhone.length < 11) {
    throw new Error('সঠিক মোবাইল নম্বর প্রদান করুন (যেমন: 017XXXXXXXX)');
  }

  // 1. Try Firebase Phone Auth (Sends real SMS via Google Firebase Phone Provider)
  let firebaseError: any = null;
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error('reCAPTCHA container পাওয়া যায়নি। পেইজ রিফ্রেশ করুন।');
    }
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {}
      });
    }
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      formattedPhone,
      window.recaptchaVerifier
    );

    return {
      confirmationResult,
      provider: 'firebase',
      phoneNumber: formattedPhone,
      message: `মোবাইল নম্বর ${formattedPhone}-এ SMS এর মাধ্যমে ভেরিফিকেশন কোড (OTP) পাঠানো হয়েছে!`
    };
  } catch (err: any) {
    console.error('Firebase phone auth SMS error:', err);
    cleanupRecaptcha();
    let errorMsg = err?.message || '';
    if (err?.code === 'auth/operation-not-allowed') {
      errorMsg = 'ফায়ারবেস কনসোলে Phone Provider এখনও সক্রিয় করা হয়নি। Firebase Console > Authentication > Sign-in method-এ Phone enable করতে হবে।';
    } else if (err?.code === 'auth/quota-exceeded') {
      errorMsg = 'ফায়ারবেস ফ্রি SMS কোটা শেষ হয়ে গেছে।';
    } else if (err?.code === 'auth/invalid-phone-number') {
      errorMsg = 'মোবাইল নম্বর সঠিক নয় (যেমন: 017XXXXXXXX)।';
    } else if (err?.code === 'auth/too-many-requests') {
      errorMsg = 'অতিরিক্ত ওটিপি চাওয়ার কারণে ফায়ারবেস সাময়িক ব্লক করেছে। কিছুক্ষণ পর চেষ্টা করুন।';
    }
    throw new Error(errorMsg || `অফিসিয়াল এসএমএস ওটিপি পাঠানো যায়নি: ${err.message}`);
  }
}

/**
 * Verify OTP code entered by user
 */
export async function verifyPhoneOtpCode(params: {
  phoneNumber: string;
  code: string;
  confirmationResult?: ConfirmationResult | null;
  name?: string;
  email?: string;
  password?: string;
  isLinking?: boolean;
}): Promise<{
  user: any;
  token?: string;
  message: string;
}> {
  const formattedPhone = formatPhoneNumber(params.phoneNumber);
  const cleanCode = params.code.trim();

  let firebaseUid = '';

  // Confirm via Firebase if ConfirmationResult is present
  if (params.confirmationResult) {
    try {
      const userCredential = await params.confirmationResult.confirm(cleanCode);
      if (userCredential?.user?.uid) {
        firebaseUid = userCredential.user.uid;
      }
    } catch (fbErr: any) {
      console.warn('Firebase confirmation notice:', fbErr?.code, fbErr?.message);
      // If code was wrong according to Firebase and not test code, rethrow
      if (fbErr?.code === 'auth/invalid-verification-code') {
        throw new Error('ভুল ভেরিফিকেশন কোড! অনুগ্রহ করে SMS চেক করে সঠিক কোড দিন।');
      }
      if (fbErr?.code === 'auth/code-expired') {
        throw new Error('ভেরিফিকেশন কোডের মেয়াদ শেষ হয়ে গেছে। নতুন কোড পাঠান।');
      }
    }
  }

  const endpoint = params.isLinking ? '/api/auth/phone/link' : '/api/auth/phone/verify-otp';
  const authToken = localStorage.getItem('bot_auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phoneNumber: formattedPhone,
      code: cleanCode,
      name: params.name,
      email: params.email,
      password: params.password,
      firebaseUid: firebaseUid || undefined
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'ভেরিফিকেশন কোড সঠিক নয়');
  }

  return data;
}
