'use client';

import React, { useState } from 'react';
import { api, setAuthToken, setAppMode, getAppMode, setApiUrl } from '@/lib/api';
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
  ShieldCheck,
} from 'lucide-react';

interface AuthViewProps {
  onSuccess: (user: User) => void;
}

export default function AuthView({ onSuccess }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [accountMode, setAccountMode] = useState<'offline' | 'online'>('offline');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState('http://192.168.177.131:18080/api');

  const currencies = [
    { code: 'USD', symbol: '$', name: '$' },
    { code: 'BDT', symbol: '৳', name: '৳' },
    { code: 'EUR', symbol: '€', name: '€' },
    { code: 'GBP', symbol: '£', name: '£' },
    { code: 'INR', symbol: '₹', name: '₹' },
  ];

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
      setAppMode(accountMode);

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

  // Quick 1-click Demo Fill & Login
  const handleFillAndLoginDemo = async () => {
    setError('');
    setLoading(true);
    try {
      setAppMode(accountMode);
      const res = await api.login({
        email: 'demo@incomeexpense.app',
        password: 'demo123456',
      });
      await setAuthToken(res.access_token);
      onSuccess(res.user);
    } catch (err: any) {
      // Fallback local demo
      setAppMode('offline');
      const demoUser = OfflineStorage.getUser();
      onSuccess(demoUser);
    } finally {
      setLoading(false);
    }
  };

  // Skip Login / Instant Guest Access
  const handleGuestAccess = () => {
    setAppMode('offline');
    const user = OfflineStorage.getUser();
    onSuccess(user);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-4 py-8">
      <div className="max-w-md w-full mx-auto space-y-4">
        {/* App Branding */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-[10px] mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-500/25">
            <Wallet className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            CashFlow
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Personal Income &amp; Expense Manager
          </p>
        </div>

        {/* AUTH CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-[10px] p-5 shadow-lg border border-slate-200/80 dark:border-slate-800 space-y-4">
          {/* 1. Sign In vs Register Switcher */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`flex-1 py-2 rounded-md font-bold text-xs transition-all ${
                isLogin
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`flex-1 py-2 rounded-md font-bold text-xs transition-all ${
                !isLogin
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* 2. Storage Mode Selector: On-Device (Offline) vs Cloud */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block px-1">
              Account Storage Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccountMode('offline');
                  setError('');
                }}
                className={`p-2.5 rounded-[10px] border text-left transition-all ${
                  accountMode === 'offline'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>On-Device (Local)</span>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                  100% offline • No server needed
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountMode('online');
                  setError('');
                }}
                className={`p-2.5 rounded-[10px] border text-left transition-all ${
                  accountMode === 'online'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Cloud className="w-3.5 h-3.5 text-blue-500" />
                  <span>Cloud Sync</span>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                  Port 18080 • Google Drive
                </div>
              </button>
            </div>
          </div>

          {/* Connection Error Banner with 1-Click Fallback */}
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md space-y-2">
              <div className="text-rose-600 dark:text-rose-400 text-xs font-semibold leading-relaxed">
                {error}
              </div>
              {accountMode === 'online' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMode('offline');
                      setError('');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    📱 Switch to On-Device Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowServerConfig(!showServerConfig)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors"
                  >
                    ⚙️ Server IP
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Server URL Config Accordion */}
          {showServerConfig && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-[10px] border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Backend Server IP &amp; Port:
              </label>
              <input
                type="text"
                value={customServerUrl}
                onChange={(e) => setCustomServerUrl(e.target.value)}
                placeholder="http://192.168.177.131:18080/api"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 font-mono text-xs text-slate-900 dark:text-white outline-none"
              />
              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="w-full py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-md text-xs"
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
                      placeholder="e.g. Saiful Islam"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
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
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
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
                  placeholder="Password"
                  required
                  minLength={4}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] rounded-md text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all mt-1"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <span>
                    {isLogin
                      ? accountMode === 'offline'
                        ? 'Sign In Locally'
                        : 'Sign In to Cloud'
                      : accountMode === 'offline'
                      ? 'Create Local Account'
                      : 'Create Cloud Account'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Actions Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleFillAndLoginDemo}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>⚡ 1-Click Demo Login</span>
              </button>

              <button
                type="button"
                onClick={handleGuestAccess}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
              >
                🚀 Skip / Guest Mode
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
