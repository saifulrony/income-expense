'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AdData {
  id: string;
  name: string;
  type: 'banner' | 'code' | 'script' | 'text' | 'html';
  image_url?: string;
  target_url?: string;
  title?: string;
  headline?: string;
  description?: string;
  button_text?: string;
  content?: string;
  code_snippet?: string;
  show_sponsored_badge?: boolean;
  device_target?: string;
  status: string;
}

interface AdSlotProps {
  placement?: string;
  className?: string;
}

export default function AdSlot({ placement = 'cashflow_dashboard', className = '' }: AdSlotProps) {
  const [ad, setAd] = useState<AdData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute backend API host dynamically from browser window location
  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '192.168.177.131';
      return `http://${host}:8001`;
    }
    return 'http://192.168.177.131:8001';
  };

  useEffect(() => {
    const apiUrl = getApiUrl();
    let isMounted = true;

    fetch(`${apiUrl}/api/v1/ads/public/${encodeURIComponent(placement)}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (isMounted && data && (data.id || data.type)) {
          setAd(data);
        }
      })
      .catch(() => {
        // Silently ignore if no ads available or backend unreachable
      });

    return () => {
      isMounted = false;
    };
  }, [placement]);

  // Execute scripts if ad type is script / code / AdSense
  useEffect(() => {
    if (!ad || (ad.type !== 'script' && ad.type !== 'code') || !containerRef.current) return;

    const container = containerRef.current;
    const rawSnippet = ad.code_snippet || ad.content || '';
    if (!rawSnippet) return;

    container.innerHTML = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawSnippet;

    Array.from(tempDiv.childNodes).forEach((node) => {
      if (node.nodeName !== 'SCRIPT') {
        container.appendChild(node.cloneNode(true));
      }
    });

    const scripts = tempDiv.getElementsByTagName('script');
    Array.from(scripts).forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      container.appendChild(newScript);
    });

    // Check if adsbygoogle needs initialization
    if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        // Ignore adsbygoogle push error
      }
    }
  }, [ad]);

  if (!ad || isDismissed) return null;

  // Client-side device target verification (screen width + UA)
  if (typeof window !== 'undefined' && ad.device_target && ad.device_target !== 'all') {
    const isMobileScreen = window.innerWidth < 768;
    const isMobileUA = /mobile|android|iphone|ipad|tablet/i.test(navigator.userAgent);
    const isMobile = isMobileScreen || isMobileUA;

    if (ad.device_target === 'mobile' && !isMobile) {
      return null;
    }
    if (ad.device_target === 'desktop' && isMobile) {
      return null;
    }
  }

  const handleAdClick = () => {
    if (!ad.id) return;
    const apiUrl = getApiUrl();
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(`${apiUrl}/api/v1/ads/public/${ad.id}/click`);
      } else {
        fetch(`${apiUrl}/api/v1/ads/public/${ad.id}/click`, { method: 'POST', mode: 'no-cors' });
      }
    } catch (e) {
      // Ignore click beacon failure
    }
  };

  return (
    <div
      className={`relative my-3 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm shadow-xs text-center overflow-hidden transition-all duration-200 ${className}`}
    >
      {ad.show_sponsored_badge !== false && (
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
            Sponsored
          </span>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs px-1"
            title="Dismiss ad"
          >
            ✕
          </button>
        </div>
      )}

      {ad.type === 'banner' && ad.image_url ? (
        <a
          href={ad.target_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleAdClick}
          className="block group"
        >
          <img
            src={ad.image_url}
            alt={ad.title || 'Advertisement'}
            className="w-full max-h-[160px] object-cover rounded-lg group-hover:opacity-95 transition-opacity"
          />
          {ad.title && (
            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
              {ad.title}
            </p>
          )}
        </a>
      ) : ad.type === 'code' || ad.type === 'script' ? (
        <div
          ref={containerRef}
          onClick={handleAdClick}
          className="min-h-[50px] flex items-center justify-center overflow-auto"
        />
      ) : ad.type === 'text' ? (
        <div className="flex items-center justify-between gap-3 text-left p-2">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{ad.headline || ad.name}</h4>
            {ad.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ad.description}</p>}
          </div>
          {ad.target_url && (
            <a
              href={ad.target_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleAdClick}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
            >
              {ad.button_text || 'Learn More ↗'}
            </a>
          )}
        </div>
      ) : (
        <div
          onClick={handleAdClick}
          className="text-left overflow-auto"
          dangerouslySetInnerHTML={{ __html: ad.content || '' }}
        />
      )}
    </div>
  );
}
