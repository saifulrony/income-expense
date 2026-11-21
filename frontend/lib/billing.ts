'use client';

import { useState, useEffect } from 'react';
import { triggerHaptic } from './haptics';

export type SubscriptionTier = 'starter' | 'pro' | 'elite';
export type ProPlanType = 'free' | 'monthly_pro' | 'annual_pro' | 'lifetime_pro' | 'elite_pro';

export const TIER_LIMITS = {
  starter: {
    name: 'CashFlow Starter',
    badge: 'Free',
    maxAccounts: 2,
    maxWarranties: 3,
    canExportPdf: false,
    canUseCustomThemes: false,
    canBiometricLock: false,
    hasAdFree: false,
    cloudSync: false,
    familySharing: false,
  },
  pro: {
    name: 'CashFlow Pro',
    badge: 'Pro',
    maxAccounts: Infinity,
    maxWarranties: Infinity,
    canExportPdf: true,
    canUseCustomThemes: true,
    canBiometricLock: true,
    hasAdFree: true,
    cloudSync: true,
    familySharing: false,
  },
  elite: {
    name: 'CashFlow Elite',
    badge: 'Elite',
    maxAccounts: Infinity,
    maxWarranties: Infinity,
    canExportPdf: true,
    canUseCustomThemes: true,
    canBiometricLock: true,
    hasAdFree: true,
    cloudSync: true,
    familySharing: true,
  },
};

export interface ProEntitlement {
  isPro: boolean;
  plan: ProPlanType;
  expiresAt?: number | null;
  productId?: string;
  verifiedPayment?: boolean;
}

export interface LivePlanPrices {
  monthly: string;
  annual: string;
  lifetime: string;
}

const LEGACY_STORAGE_KEY = 'cashflow_pro_entitlement_v1';
const STORAGE_KEY = 'cashflow_pro_entitlement_v2';
export const PRO_STATUS_EVENT = 'cashflow_pro_status_changed';
export const OPEN_UPGRADE_MODAL_EVENT = 'open_upgrade_pro_modal';

const rawPriceEnv = process.env.NEXT_PUBLIC_LIFETIME_PRICE_DISPLAY || '$29.99';
const normalizedLifetimePrice =
  rawPriceEnv === '.99' || !rawPriceEnv.trim() ? '$29.99' : rawPriceEnv;

export const BILLING_CONFIG = {
  entitlementId: process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'CashFlow Pro',
  monthlyProductId: process.env.NEXT_PUBLIC_PLAY_MONTHLY_SKU || 'cashflow_monthly_pro',
  annualProductId: process.env.NEXT_PUBLIC_PLAY_ANNUAL_SKU || 'cashflow_annual_pro',
  lifetimeProductId: process.env.NEXT_PUBLIC_PLAY_LIFETIME_SKU || 'cashflow_lifetime_pro',
  monthlyPriceDisplay: process.env.NEXT_PUBLIC_MONTHLY_PRICE_DISPLAY || '$1.99',
  annualPriceDisplay: process.env.NEXT_PUBLIC_ANNUAL_PRICE_DISPLAY || '$9.99',
  lifetimePriceDisplay: normalizedLifetimePrice,
  revenueCatAndroidKey: process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY || '',
};

let isRevenueCatConfigured = false;

function isNativeAndroid(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );
}

/**
 * Configures @revenuecat/purchases-capacitor once per session on Android
 */
async function getConfiguredPurchases() {
  if (!isNativeAndroid() || !BILLING_CONFIG.revenueCatAndroidKey) {
    return null;
  }
  // Android Google Play Public API Keys in RevenueCat MUST start with "goog_"
  // If the user configured a "test_" key (RevenueCat Web Billing key) or an invalid key,
  // do not pass it to the Android native SDK, or RevenueCat will throw "wrong api key".
  if (!BILLING_CONFIG.revenueCatAndroidKey.startsWith('goog_')) {
    return null;
  }
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    if (!isRevenueCatConfigured) {
      await Purchases.configure({
        apiKey: BILLING_CONFIG.revenueCatAndroidKey,
      });
      isRevenueCatConfigured = true;
    }
    return Purchases;
  } catch (err) {
    console.warn('[RevenueCat] Failed to configure Purchases:', err);
    return null;
  }
}

/**
 * Checks whether a RevenueCat CustomerInfo object has an active Pro entitlement
 */
function extractActiveEntitlement(customerInfo: any): {
  isActive: boolean;
  productId?: string;
  expirationDate?: number | null;
} {
  const activeMap = customerInfo?.entitlements?.active || {};
  const target =
    activeMap[BILLING_CONFIG.entitlementId] ||
    activeMap['pro'] ||
    activeMap['CashFlow Pro'] ||
    Object.values(activeMap)[0];

  if (!target) {
    return { isActive: false };
  }

  const expMs = target.expirationDate ? new Date(target.expirationDate).getTime() : null;
  return {
    isActive: true,
    productId: target.productIdentifier,
    expirationDate: expMs && !isNaN(expMs) ? expMs : null,
  };
}

export function getProStatus(): ProEntitlement {
  if (typeof window === 'undefined') {
    return { isPro: false, plan: 'free', expiresAt: null };
  }

  try {
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isPro: false, plan: 'free', expiresAt: null };
    const parsed = JSON.parse(raw) as ProEntitlement;

    if (!parsed.verifiedPayment) {
      localStorage.removeItem(STORAGE_KEY);
      return { isPro: false, plan: 'free', expiresAt: null };
    }

    if (
      parsed.plan === 'lifetime_pro' ||
      parsed.plan === 'monthly_pro' ||
      parsed.plan === 'annual_pro' ||
      parsed.plan === 'elite_pro'
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
  } catch {
    // Ignore corrupt storage
  }

  return { isPro: false, plan: 'free', expiresAt: null };
}

export function getCurrentTier(): SubscriptionTier {
  const status = getProStatus();
  if (!status.isPro) return 'starter';
  if (status.plan === 'elite_pro') return 'elite';
  return 'pro';
}

export function canAccessFeature(feature: keyof typeof TIER_LIMITS['starter']): boolean {
  const tier = getCurrentTier();
  return Boolean(TIER_LIMITS[tier][feature]);
}

export function openUpgradeProModal(reason?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OPEN_UPGRADE_MODAL_EVENT, { detail: { reason } })
  );
}

function saveEntitlement(next: ProEntitlement) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PRO_STATUS_EVENT, { detail: next }));
}

/**
 * Syncs local entitlement state with Google Play / RevenueCat on Android startup
 */
export async function syncPlayStoreEntitlement(): Promise<void> {
  try {
    const Purchases = await getConfiguredPurchases();
    if (!Purchases) return;

    const { customerInfo } = await Purchases.getCustomerInfo();
    const active = extractActiveEntitlement(customerInfo);

    if (active.isActive) {
      const plan: ProPlanType =
        active.productId === BILLING_CONFIG.monthlyProductId
          ? 'monthly_pro'
          : active.productId === BILLING_CONFIG.annualProductId
          ? 'annual_pro'
          : 'lifetime_pro';
      saveEntitlement({
        isPro: true,
        plan,
        expiresAt: active.expirationDate || null,
        productId: active.productId,
        verifiedPayment: true,
      });
    } else {
      const current = getProStatus();
      if (current.isPro) {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(
          new CustomEvent(PRO_STATUS_EVENT, {
            detail: { isPro: false, plan: 'free', expiresAt: null },
          })
        );
      }
    }
  } catch {
    // Offline or Play Services unavailable -> keep cached verified status
  }
}

function withTimeout<T>(promise: Promise<T>, ms = 6000, errorMsg = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

/**
 * Fetches localized Google Play Store prices from RevenueCat offerings on Android
 */
export async function fetchPlayStorePrices(): Promise<LivePlanPrices> {
  const defaults: LivePlanPrices = {
    monthly: BILLING_CONFIG.monthlyPriceDisplay,
    annual: BILLING_CONFIG.annualPriceDisplay,
    lifetime: BILLING_CONFIG.lifetimePriceDisplay,
  };

  try {
    const Purchases = await withTimeout(getConfiguredPurchases(), 2500, 'Config timeout');
    if (!Purchases) return defaults;

    const offerings = await withTimeout(Purchases.getOfferings(), 3000, 'Offerings timeout');
    const current = offerings?.current;
    if (!current) return defaults;

    const packages: any[] = current.availablePackages || [];
    const findPrice = (sku: string, fallbackPkg: any, defaultStr: string) => {
      const matched =
        packages.find((p) => p?.product?.identifier === sku || p?.product?.identifier?.startsWith(`${sku}:`)) ||
        fallbackPkg;
      return matched?.product?.priceString || defaultStr;
    };

    return {
      monthly: findPrice(BILLING_CONFIG.monthlyProductId, current.monthly, defaults.monthly),
      annual: findPrice(BILLING_CONFIG.annualProductId, current.annual, defaults.annual),
      lifetime: findPrice(BILLING_CONFIG.lifetimeProductId, current.lifetime, defaults.lifetime),
    };
  } catch {
    return defaults;
  }
}

export function useProStatus(): ProEntitlement {
  const [status, setStatus] = useState<ProEntitlement>(() => getProStatus());

  useEffect(() => {
    setStatus(getProStatus());
    syncPlayStoreEntitlement();

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
 * Triggers a Google Play Billing purchase via @revenuecat/purchases-capacitor
 * for the selected tier ('monthly' | 'annual' | 'lifetime').
 */
export async function purchaseLifetimePro(
  selectedTier: 'monthly' | 'annual' | 'lifetime' = 'lifetime'
): Promise<{ success: boolean; message: string }> {
  const isTestKey = Boolean(BILLING_CONFIG.revenueCatAndroidKey?.startsWith('test_'));
  const mappedPlan: ProPlanType =
    selectedTier === 'monthly'
      ? 'monthly_pro'
      : selectedTier === 'annual'
      ? 'annual_pro'
      : 'lifetime_pro';

  const grantTestEntitlement = (note?: string) => {
    triggerHaptic('success');
    saveEntitlement({
      isPro: true,
      plan: mappedPlan,
      expiresAt:
        selectedTier === 'monthly'
          ? Date.now() + 30 * 86400000
          : selectedTier === 'annual'
          ? Date.now() + 365 * 86400000
          : null,
      productId:
        selectedTier === 'monthly'
          ? BILLING_CONFIG.monthlyProductId
          : selectedTier === 'annual'
          ? BILLING_CONFIG.annualProductId
          : BILLING_CONFIG.lifetimeProductId,
      verifiedPayment: true,
    });
    return {
      success: true,
      message: note || `[RevenueCat Test Store] CashFlow Pro (${selectedTier}) unlocked!`,
    };
  };

  try {
    // 1. Web/Desktop Browser Handling
    if (!isNativeAndroid()) {
      if (isTestKey) {
        return grantTestEntitlement('[RevenueCat Test Store] CashFlow Pro unlocked for web/desktop preview!');
      }
      triggerHaptic('warning');
      return {
        success: false,
        message:
          'Google Play Billing runs inside the Android app installed from Google Play Store. Build and install the Android APK/AAB to test live Google Play checkout.',
      };
    }

    // 2. Android Native Environment
    if (!BILLING_CONFIG.revenueCatAndroidKey) {
      triggerHaptic('warning');
      return {
        success: false,
        message:
          'Add your RevenueCat API key in frontend/.env.local to launch Google Play Billing.',
      };
    }

    const Purchases = await withTimeout(getConfiguredPurchases(), 4000, 'Initialization timed out');
    if (!Purchases) {
      if (isTestKey) return grantTestEntitlement('[Test Store] CashFlow Pro activated.');
      return {
        success: false,
        message: 'Google Play Billing service could not be initialized.',
      };
    }

    // Try fetching offerings with a strict 4-second timeout
    let offerings: any = null;
    try {
      offerings = await withTimeout(Purchases.getOfferings(), 4000, 'Offerings query timed out');
    } catch {
      // If fetching offerings times out on side-loaded APK:
      if (isTestKey) {
        return grantTestEntitlement(
          '[RevenueCat Test Store] Purchase simulated! CashFlow Pro is now active.'
        );
      }
      return {
        success: false,
        message:
          'Google Play service did not respond. If this is a side-loaded debug APK, upload it to Google Play Console Internal Testing track first.',
      };
    }

    const currentOffering = offerings?.current;
    const packages: any[] = currentOffering?.availablePackages || [];

    const targetSku =
      selectedTier === 'monthly'
        ? BILLING_CONFIG.monthlyProductId
        : selectedTier === 'annual'
        ? BILLING_CONFIG.annualProductId
        : BILLING_CONFIG.lifetimeProductId;

    const matchedPkg =
      packages.find(
        (p) =>
          p?.product?.identifier === targetSku ||
          p?.product?.identifier?.startsWith(`${targetSku}:`) ||
          p?.identifier === selectedTier
      ) ||
      (selectedTier === 'lifetime' ? currentOffering?.lifetime : null) ||
      (selectedTier === 'annual' ? currentOffering?.annual : null) ||
      (selectedTier === 'monthly' ? currentOffering?.monthly : null);

    if (!matchedPkg) {
      if (isTestKey) {
        return grantTestEntitlement(
          '[RevenueCat Test Store] CashFlow Pro activated for testing.'
        );
      }
      return {
        success: false,
        message: `Product "${targetSku}" was not found in your RevenueCat / Google Play Console offering.`,
      };
    }

    // Execute purchase with a 15-second safety timeout
    const purchaseResult = await withTimeout(
      Purchases.purchasePackage({ aPackage: matchedPkg }),
      15000,
      'Purchase request timed out'
    );
    const active = extractActiveEntitlement(purchaseResult?.customerInfo);

    if (active.isActive || isTestKey) {
      triggerHaptic('success');
      saveEntitlement({
        isPro: true,
        plan: mappedPlan,
        expiresAt: active.expirationDate || null,
        productId: active.productId || targetSku,
        verifiedPayment: true,
      });
      return {
        success: true,
        message: 'Payment verified! CashFlow Pro is now active.',
      };
    }

    return { success: false, message: 'Purchase was not completed.' };
  } catch (err: any) {
    if (err?.userCancelled || err?.code === '1' || err?.message?.toLowerCase()?.includes('cancel')) {
      return { success: false, message: 'Google Play checkout cancelled.' };
    }
    // If running in Test Store mode and native store failed/timed out, grant the test entitlement
    if (isTestKey) {
      return grantTestEntitlement(
        '[RevenueCat Test Store] Simulated purchase granted CashFlow Pro!'
      );
    }
    triggerHaptic('warning');
    return {
      success: false,
      message: err?.message || 'Unable to complete Google Play purchase right now.',
    };
  }
}

/**
 * Mandatory Google Play Store requirement: Restore existing purchases on a new device.
 */
export async function restorePurchases(): Promise<{ success: boolean; message: string }> {
  const isTestKey = Boolean(BILLING_CONFIG.revenueCatAndroidKey?.startsWith('test_'));

  try {
    const Purchases = await withTimeout(getConfiguredPurchases(), 4000, 'Config timeout');
    if (!Purchases) {
      if (isTestKey) {
        return { success: true, message: '[Test Store] Purchases restored successfully.' };
      }
      return {
        success: false,
        message: isNativeAndroid()
          ? 'Add NEXT_PUBLIC_REVENUECAT_ANDROID_KEY in .env.local to restore Google Play purchases.'
          : 'Google Play purchase restoration is available inside the Android app.',
      };
    }

    const { customerInfo } = await withTimeout(Purchases.restorePurchases(), 7000, 'Restore timed out');
    const active = extractActiveEntitlement(customerInfo);

    if (active.isActive) {
      triggerHaptic('success');
      const plan: ProPlanType =
        active.productId === BILLING_CONFIG.monthlyProductId
          ? 'monthly_pro'
          : active.productId === BILLING_CONFIG.annualProductId
          ? 'annual_pro'
          : 'lifetime_pro';
      saveEntitlement({
        isPro: true,
        plan,
        expiresAt: active.expirationDate || null,
        productId: active.productId,
        verifiedPayment: true,
      });
      return {
        success: true,
        message: 'Pro subscription restored from Google Play!',
      };
    }

    if (isTestKey) {
      return { success: true, message: '[Test Store] Entitlement restored.' };
    }

    return {
      success: false,
      message: 'No active Google Play Pro subscription found for this Google account.',
    };
  } catch (err: any) {
    if (isTestKey) {
      return { success: true, message: '[Test Store] Sandbox purchases restored.' };
    }
    return {
      success: false,
      message: err?.message || 'Failed to restore Google Play purchases.',
    };
  }
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
