'use client';

import { useState, useEffect } from 'react';
import { triggerHaptic } from './haptics';

export type ProPlanType = 'free' | 'rewarded_pass' | 'monthly_pro' | 'annual_pro' | 'lifetime_pro';

export interface ProEntitlement {
  isPro: boolean;
  plan: ProPlanType;
  expiresAt?: number | null;
  productId?: string;
  verifiedPayment?: boolean;
}

const LEGACY_STORAGE_KEY = 'cashflow_pro_entitlement_v1';
const STORAGE_KEY = 'cashflow_pro_entitlement_v2';
export const PRO_STATUS_EVENT = 'cashflow_pro_status_changed';

const rawPriceEnv = process.env.NEXT_PUBLIC_LIFETIME_PRICE_DISPLAY || '$4.99';
const normalizedLifetimePrice =
  rawPriceEnv === '.99' || !rawPriceEnv.trim() ? '$4.99' : rawPriceEnv;

export const BILLING_CONFIG = {
  monthlyProductId: process.env.NEXT_PUBLIC_PLAY_MONTHLY_SKU || 'cashflow_monthly_pro',
  annualProductId: process.env.NEXT_PUBLIC_PLAY_ANNUAL_SKU || 'cashflow_annual_pro',
  lifetimeProductId: process.env.NEXT_PUBLIC_PLAY_LIFETIME_SKU || 'cashflow_lifetime_pro',
  lifetimePriceDisplay: normalizedLifetimePrice,
  revenueCatAndroidKey: process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY || '',
  admobRewardedUnitId: process.env.NEXT_PUBLIC_ADMOB_REWARDED_ID || '',
  rewardPassDays: 7,
};

export function getProStatus(): ProEntitlement {
  if (typeof window === 'undefined') {
    return { isPro: false, plan: 'free', expiresAt: null };
  }

  try {
    // Purge legacy unverified preview entitlement so users are never auto-activated without payment
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isPro: false, plan: 'free', expiresAt: null };
    const parsed = JSON.parse(raw) as ProEntitlement;

    // Require verified payment flag so stale/unpaid storage never unlocks Pro
    if (!parsed.verifiedPayment) {
      localStorage.removeItem(STORAGE_KEY);
      return { isPro: false, plan: 'free', expiresAt: null };
    }

    if (
      parsed.plan === 'lifetime_pro' ||
      parsed.plan === 'monthly_pro' ||
      parsed.plan === 'annual_pro'
    ) {
      if (parsed.expiresAt && Date.now() >= parsed.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return { isPro: false, plan: 'free', expiresAt: null };
      }
      return {
        isPro: true,
        plan: parsed.plan,
        expiresAt: parsed.expiresAt || null,
        productId: parsed.productId || BILLING_CONFIG.lifetimeProductId,
        verifiedPayment: true,
      };
    }

    if (parsed.plan === 'rewarded_pass' && parsed.expiresAt) {
      if (Date.now() < parsed.expiresAt) {
        return {
          isPro: true,
          plan: 'rewarded_pass',
          expiresAt: parsed.expiresAt,
          verifiedPayment: true,
        };
      }
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
 * Triggers a Google Play Billing purchase for the selected plan ('monthly' | 'annual' | 'lifetime').
 * Never activates Pro without an actual verified Google Play transaction.
 */
export async function purchaseLifetimePro(
  selectedTier: 'monthly' | 'annual' | 'lifetime' = 'lifetime'
): Promise<{ success: boolean; message: string }> {
  try {
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.();

    const rcPlugin =
      typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins?.Purchases : null;

    if (isCapacitorNative && rcPlugin && BILLING_CONFIG.revenueCatAndroidKey) {
      await rcPlugin.configure({ apiKey: BILLING_CONFIG.revenueCatAndroidKey });
      const offerings = await rcPlugin.getOfferings();
      const currentOffering = offerings?.current;

      const targetSku =
        selectedTier === 'monthly'
          ? BILLING_CONFIG.monthlyProductId
          : selectedTier === 'annual'
          ? BILLING_CONFIG.annualProductId
          : BILLING_CONFIG.lifetimeProductId;

      const matchedPkg =
        currentOffering?.availablePackages?.find(
          (p: any) => p?.product?.identifier === targetSku || p?.identifier === selectedTier
        ) ||
        (selectedTier === 'lifetime' ? currentOffering?.lifetime : null) ||
        (selectedTier === 'annual' ? currentOffering?.annual : null) ||
        (selectedTier === 'monthly' ? currentOffering?.monthly : null) ||
        currentOffering?.availablePackages?.[0];

      if (!matchedPkg) {
        return {
          success: false,
          message: 'No active Google Play Store product found for this plan.',
        };
      }

      const purchaseResult = await rcPlugin.purchasePackage({ aPackage: matchedPkg });
      if (purchaseResult?.customerInfo?.entitlements?.active?.pro) {
        triggerHaptic('success');
        const mappedPlan: ProPlanType =
          selectedTier === 'monthly'
            ? 'monthly_pro'
            : selectedTier === 'annual'
            ? 'annual_pro'
            : 'lifetime_pro';
        saveEntitlement({
          isPro: true,
          plan: mappedPlan,
          expiresAt: null,
          productId: targetSku,
          verifiedPayment: true,
        });
        return {
          success: true,
          message: 'Payment verified! CashFlow Pro is now active on your account.',
        };
      }
      return { success: false, message: 'Payment was not completed.' };
    }

    // Do NOT grant free Pro when payment processor is not connected
    triggerHaptic('warning');
    if (!isCapacitorNative) {
      return {
        success: false,
        message:
          'Google Play Billing checkout requires the Android app installed from Google Play Store.',
      };
    }

    return {
      success: false,
      message:
        'Google Play Billing is not configured yet. Add your Play Store / RevenueCat billing key (NEXT_PUBLIC_REVENUECAT_ANDROID_KEY) to process live payments.',
    };
  } catch (err: any) {
    if (err?.userCancelled) {
      return { success: false, message: 'Payment cancelled.' };
    }
    triggerHaptic('warning');
    return { success: false, message: err?.message || 'Unable to process payment right now.' };
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
    const rcPlugin =
      typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins?.Purchases : null;

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
          verifiedPayment: true,
        });
        return { success: true, message: 'Your CashFlow Pro purchase has been restored!' };
      }
      return {
        success: false,
        message: 'No previous CashFlow Pro purchase found for this Google Play account.',
      };
    }

    return {
      success: false,
      message: 'No verified Google Play purchase found for this account.',
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not restore purchases.' };
  }
}

export async function unlockViaRewardedAd(): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message: 'Please select a plan above to subscribe or purchase CashFlow Pro.',
  };
}

export function resetProStatusForTesting() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(PRO_STATUS_EVENT, {
      detail: { isPro: false, plan: 'free', expiresAt: null },
    })
  );
}
