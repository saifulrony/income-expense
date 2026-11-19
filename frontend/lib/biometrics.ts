'use client';

const BIOMETRIC_ENABLED_KEY = 'cashflow_biometric_enabled';
const BIOMETRIC_CRED_KEY = 'cashflow_biometric_cred_id';

export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
}

export function disableBiometric() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CRED_KEY);
}

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Check native Capacitor Biometric plugin (if present in Android APK)
  const nativeBio = (window as any).Capacitor?.Plugins?.NativeBiometric;
  if (nativeBio?.isAvailable) {
    try {
      const res = await nativeBio.isAvailable();
      if (res?.isAvailable) return true;
    } catch {}
  }

  // 2. Check WebAuthn platform authenticator (Android Fingerprint / iOS Face ID / Windows Hello)
  if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  return false;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Registers device Fingerprint / Face ID for quick unlock.
 */
export async function enableBiometricUnlock(): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Biometrics not available.' };
  }

  // 1. Native Capacitor Biometric (Android BiometricPrompt with Phone Pattern/PIN fallback)
  const nativeBio = (window as any).Capacitor?.Plugins?.NativeBiometric;
  if (nativeBio?.verifyIdentity) {
    try {
      await nativeBio.verifyIdentity({
        reason: 'Use your phone Fingerprint, Face, or Screen Lock to protect CashFlow',
        title: 'Enable Phone Lock',
        useFallback: true,
      });
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      return { success: true, message: 'Phone Lock enabled! CashFlow will now use your device unlock.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Device verification cancelled.' };
    }
  }

  // 2. WebAuthn Platform Authenticator (requires HTTPS or localhost)
  if (!window.isSecureContext) {
    return {
      success: false,
      message: 'Browser biometrics require HTTPS (or installed Android APK). Works automatically once deployed on HTTPS.',
    };
  }

  if (!window.PublicKeyCredential || !navigator.credentials?.create) {
    return { success: false, message: 'Biometric authentication is not supported on this browser.' };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'CashFlow', id: window.location.hostname },
        user: {
          id: userId,
          name: 'cashflow-device-user',
          displayName: 'CashFlow User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (cred && cred.rawId) {
      localStorage.setItem(BIOMETRIC_CRED_KEY, bufferToBase64(cred.rawId));
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      return { success: true, message: 'Fingerprint / Face Unlock enabled!' };
    }
    return { success: false, message: 'Could not register biometric credential.' };
  } catch (err: any) {
    return {
      success: false,
      message: err?.name === 'NotAllowedError'
        ? 'Biometric prompt was cancelled.'
        : err?.message || 'Failed to enable biometrics.',
    };
  }
}

/**
 * Prompts device Fingerprint / Face ID to unlock the PIN screen.
 */
export async function verifyBiometricUnlock(): Promise<boolean> {
  if (typeof window === 'undefined' || !isBiometricEnabled()) return false;

  // 1. Native Capacitor Biometric (accepts Fingerprint, Face, or Phone Pattern/PIN)
  const nativeBio = (window as any).Capacitor?.Plugins?.NativeBiometric;
  if (nativeBio?.verifyIdentity) {
    try {
      await nativeBio.verifyIdentity({
        reason: 'Unlock CashFlow using your phone lock',
        title: 'Unlock CashFlow',
        useFallback: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  // 2. WebAuthn Platform Authenticator
  const storedCredId = localStorage.getItem(BIOMETRIC_CRED_KEY);
  if (!storedCredId || !window.PublicKeyCredential || !navigator.credentials?.get) {
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: 'public-key',
            id: base64ToBuffer(storedCredId),
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return !!assertion;
  } catch {
    return false;
  }
}
