'use client';

import React, { useState } from 'react';
import { api, setAuthToken, setAppMode, setApiUrl, getApiUrl } from '@/lib/api';
import { OfflineStorage } from '@/lib/offline-storage';
import { User } from '@/lib/types';
import {
  Wallet,
  Lock,
  Mail,
  User as UserIcon,
  Coins,
  ArrowRight,
  HardDrive,
  Cloud,
  CheckCircle2,
  Server,
  Sparkles,
} from 'lucide-react';

interface AuthViewProps {
  onSuccess: (user: User) => void;
}

export default function AuthView({ onSuccess }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState('http://192.168.177.131:18080/api');

  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
    { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (৳)' },
    { code: 'EUR', symbol: '€', name: 'Euro (€)' },
    { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar (C$)' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)' },
  ];

  // Start in 100% Offline Mode (No network required)
  const handleStartOffline = () => {
    setAppMode('offline');
    const user = OfflineStorage.getUser();
    onSuccess(user);
  };

  const handleSaveServerUrl = async () => {
    if (customServerUrl.trim()) {
      await setApiUrl(customServerUrl.trim());
      setError('');
      setShowServerConfig(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      setAppMode('online');
      if (isLogin) {
        const res = await api.login({ email, password });
        await setAuthToken(res.access_token);
        onSuccess(res.user);
      } else {
        const res = await api.register({
          email,
          password,
          full_name: fullName,
          currency,
        });
        await setAuthToken(res.access_token);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@incomeexpense.app');
    setPassword('demo123456');
    setFullName('Saiful Islam');
    setCurrency('USD');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-4 py-8">
      <div className="max-w-md w-full mx-auto space-y-5">
        {/* App Branding */}
        <div className="text-center space-y-1.5">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-500/25">
            <Wallet className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            CashFlow
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Personal Finance Tracker • Offline &amp; Cloud Ready
          </p>
        </div>

        {/* 1. HERO CARD: OFFLINE DEVICE MODE (Instant Entry, 0 Setup) */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10 rounded-2xl p-4 border border-emerald-500/30 dark:border-emerald-500/30 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Offline Device Mode
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Zero internet or server needed. All financial records and analytics are stored directly on this phone.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartOffline}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] rounded-xl text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Using Offline (On-Device)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Or Sync with Cloud Account
          </span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        {/* 2. CLOUD AUTH CARD (Online Mode) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-lg border border-slate-200/80 dark:border-slate-800 space-y-4">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${
                isLogin
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cloud Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${
                !isLogin
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Connection Error Banner with 1-Click Offline Fallback */}
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2">
              <div className="text-rose-600 dark:text-rose-400 text-xs font-semibold leading-relaxed">
                {error}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleStartOffline}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold shadow-xs hover:bg-emerald-700 transition-colors"
                >
                  🚀 Switch to Offline Mode
                </button>
                <button
                  type="button"
                  onClick={() => setShowServerConfig(!showServerConfig)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold hover:bg-slate-300 transition-colors"
                >
                  ⚙️ Fix Server URL
                </button>
              </div>
            </div>
          )}

          {/* Server URL Config Accordion */}
          {showServerConfig && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Backend Server IP &amp; Port:
              </label>
              <input
                type="text"
                value={customServerUrl}
                onChange={(e) => setCustomServerUrl(e.target.value)}
                placeholder="http://192.168.177.131:18080/api"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 font-mono text-xs text-slate-900 dark:text-white outline-none"
              />
              <p className="text-[10px] text-slate-500 leading-tight">
                Tip: If testing on a real phone via Wi-Fi, replace <code>localhost</code> with your computer's local Wi-Fi IP (e.g. <code>192.168.177.131:18080/api</code>).
              </p>
              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="w-full py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-xs"
              >
                Apply Server URL
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isLogin && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Currency
                  </label>
                  <div className="relative">
                    <Coins className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    >
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.99] rounded-xl text-white dark:text-slate-900 font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all mt-1"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>{isLogin ? 'Sign In to Cloud' : 'Create Cloud Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials shortcut */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              ⚡ Fill Demo Cloud Credentials
            </button>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 font-medium"
            >
              <Server className="w-3 h-3" />
              <span>Server Config</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
