'use client';

import { useState, useEffect } from 'react';
import { triggerHaptic } from './haptics';

export type ProPlanType = 'free' | 'rewarded_pass' | 'lifetime_pro';

export interface ProEntitlement {
  isPro: boolean;
  plan: ProPlanType;
  expiresAt?: number | null;
  productId?: string;
}

const STORAGE_KEY = 'cashflow_pro_entitlement_v1';
export const PRO_STATUS_EVENT = 'cashflow_pro_status_changed';

export const BILLING_CONFIG = {
  lifetimeProductId: process.env.NEXT_PUBLIC_PLAY_LIFETIME_SKU || 'cashflow_lifetime_pro',
  lifetimePriceDisplay: process.env.NEXT_PUBLIC_LIFETIME_PRICE_DISPLAY || '$4.99',
  revenueCatAndroidKey: process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY || '',
  admobRewardedUnitId: process.env.NEXT_PUBLIC_ADMOB_REWARDED_ID || '',
  rewardPassDays: 7,
};

export function getProStatus(): ProEntitlement {
  if (typeof window === 'undefined') {
    return { isPro: false, plan: 'free', expiresAt: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isPro: false, plan: 'free', expiresAt: null };
    const parsed = JSON.parse(raw) as ProEntitlement;

    if (parsed.plan === 'lifetime_pro') {
      return {
        isPro: true,
        plan: 'lifetime_pro',
        expiresAt: null,
        productId: parsed.productId || BILLING_CONFIG.lifetimeProductId,
      };
    }

    if (parsed.plan === 'rewarded_pass' && parsed.expiresAt) {
      if (Date.now() < parsed.expiresAt) {
        return {
          isPro: true,
          plan: 'rewarded_pass',
          expiresAt: parsed.expiresAt,
        };
      }
      // Rewarded pass expired -> reset cleanly
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore corrupt storage
  }

  return { isPro: false, plan: 'free', expiresAt: null };
}

function saveEntitlement(next: ProEntitlement) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PRO_STATUS_EVENT, { detail: next }));
}

export function useProStatus(): ProEntitlement {
  const [status, setStatus] = useState<ProEntitlement>(() => getProStatus());

  useEffect(() => {
    setStatus(getProStatus());
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as ProEntitlement | undefined;
      setStatus(detail || getProStatus());
    };
    window.addEventListener(PRO_STATUS_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener(PRO_STATUS_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  return status;
}

/**
 * Triggers a One-Time Lifetime Pro unlock via Google Play Billing (RevenueCat Capacitor bridge)
 * when running as a signed Play Store Android app, or simulates/guides cleanly in web preview.
 */
export async function purchaseLifetimePro(): Promise<{ success: boolean; message: string }> {
  try {
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.();

    // 1. Live Google Play Billing via RevenueCat Capacitor Plugin (if installed & configured)
    const rcPlugin = typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins?.Purchases : null;
    if (isCapacitorNative && rcPlugin && BILLING_CONFIG.revenueCatAndroidKey) {
      await rcPlugin.configure({ apiKey: BILLING_CONFIG.revenueCatAndroidKey });
      const offerings = await rcPlugin.getOfferings();
      const lifetimePkg = offerings?.current?.lifetime || offerings?.current?.availablePackages?.[0];
      if (!lifetimePkg) {
        return { success: false, message: 'No active Play Store product found. Please try again later.' };
      }
      const purchaseResult = await rcPlugin.purchasePackage({ aPackage: lifetimePkg });
      if (purchaseResult?.customerInfo?.entitlements?.active?.pro) {
        triggerHaptic('success');
        saveEntitlement({
          isPro: true,
          plan: 'lifetime_pro',
          expiresAt: null,
          productId: BILLING_CONFIG.lifetimeProductId,
        });
        return { success: true, message: 'CashFlow Lifetime Pro unlocked! Thank you for your support.' };
      }
      return { success: false, message: 'Purchase was not completed.' };
    }

    // 2. Web / Local Preview Mode (before RevenueCat key is added)
    if (!BILLING_CONFIG.revenueCatAndroidKey) {
      triggerHaptic('success');
      saveEntitlement({
        isPro: true,
        plan: 'lifetime_pro',
        expiresAt: null,
        productId: BILLING_CONFIG.lifetimeProductId,
      });
      return {
        success: true,
        message: 'Lifetime Pro activated (Local Preview Mode). Connect NEXT_PUBLIC_REVENUECAT_ANDROID_KEY in .env.local for live Google Play Billing.',
      };
    }

    return {
      success: false,
      message: 'Google Play Billing is available inside the installed Android app.',
    };
  } catch (err: any) {
    if (err?.userCancelled) {
      return { success: false, message: 'Purchase cancelled.' };
    }
    triggerHaptic('warning');
    return { success: false, message: err?.message || 'Unable to complete purchase right now.' };
  }
}

/**
 * Mandatory Google Play Store requirement: Restore existing purchases on a new device.
 */
export async function restorePurchases(): Promise<{ success: boolean; message: string }> {
  try {
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.();
    const rcPlugin = typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins?.Purchases : null;

    if (isCapacitorNative && rcPlugin && BILLING_CONFIG.revenueCatAndroidKey) {
      await rcPlugin.configure({ apiKey: BILLING_CONFIG.revenueCatAndroidKey });
      const result = await rcPlugin.restorePurchases();
      if (result?.customerInfo?.entitlements?.active?.pro) {
        triggerHaptic('success');
        saveEntitlement({
          isPro: true,
          plan: 'lifetime_pro',
          expiresAt: null,
          productId: BILLING_CONFIG.lifetimeProductId,
        });
        return { success: true, message: 'Your Lifetime Pro license has been restored!' };
      }
      return { success: false, message: 'No previous Lifetime Pro purchase found for this Google account.' };
    }

    const current = getProStatus();
    if (current.isPro) {
      return { success: true, message: 'Your Pro access is already active on this device.' };
    }
    return {
      success: false,
      message: 'No previous purchase found on this device.',
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not restore purchases.' };
  }
}

/**
 * Opt-in Rewarded Video Ad Unlock (Google AdMob) -> grants a 7-day Ad-Free Pro Pass.
 * Ideal for Android users without credit cards!
 */
export async function unlockViaRewardedAd(): Promise<{ success: boolean; message: string }> {
  try {
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.();
    const admobPlugin = typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins?.AdMob : null;

    if (isCapacitorNative && admobPlugin && BILLING_CONFIG.admobRewardedUnitId) {
      await admobPlugin.prepareRewardVideoAd({
        adId: BILLING_CONFIG.admobRewardedUnitId,
        isTesting: false,
      });
      const rewardItem = await admobPlugin.showRewardVideoAd();
      if (rewardItem) {
        const expiresAt = Date.now() + BILLING_CONFIG.rewardPassDays * 24 * 60 * 60 * 1000;
        triggerHaptic('success');
        saveEntitlement({
          isPro: true,
          plan: 'rewarded_pass',
          expiresAt,
        });
        return {
          success: true,
          message: `Reward earned! Pro features unlocked free for ${BILLING_CONFIG.rewardPassDays} days.`,
        };
      }
      return { success: false, message: 'Please watch the full video to claim your 7-day Pro Pass.' };
    }

    // Local / Web Preview fallback before AdMob key is linked
    const expiresAt = Date.now() + BILLING_CONFIG.rewardPassDays * 24 * 60 * 60 * 1000;
    triggerHaptic('success');
    saveEntitlement({
      isPro: true,
      plan: 'rewarded_pass',
      expiresAt,
    });
    return {
      success: true,
      message: `7-Day Pro Pass unlocked! (Preview Mode — add NEXT_PUBLIC_ADMOB_REWARDED_ID for live AdMob videos).`,
    };
  } catch (err: any) {
    triggerHaptic('warning');
    return { success: false, message: err?.message || 'Rewarded video is temporarily unavailable.' };
  }
}

export function resetProStatusForTesting() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(PRO_STATUS_EVENT, { detail: { isPro: false, plan: 'free', expiresAt: null } }));
}
