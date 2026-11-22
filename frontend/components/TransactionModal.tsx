'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Camera,
  Trash2,
  Repeat,
  Calendar as CalendarIcon,
  ChevronDown,
  Search,
  Clock,
  Calculator,
  Delete,
  Sparkles,
  Loader2,
  KeyRound,
  ExternalLink,
  Sliders,
  Coins,
  ListChecks,
  Receipt,
  Mic,
  MicOff,
  ShoppingBag,
  Image as ImageIcon,
  Link2,
  Bot,
  Send,
  Undo2,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { Category, Transaction, SubAccount } from '@/lib/types';
import { CategoryIcon } from './CategoryIcons';
import { api } from '@/lib/api';
import { getCurrencySymbol } from '@/lib/currency';
import { getCurrentTimeInputValue, formatLocalDate, hasExplicitTime, combineDateAndTime } from '@/lib/time-settings';
import { useFlowLabels } from '@/lib/ui-prefs';
import { triggerHaptic } from '@/lib/haptics';
import {
  scanReceiptSmart,
  scanReceiptWithGemini,
  compressImageForOcr,
  hasGeminiApiKey,
  getGeminiApiKey,
  setGeminiApiKey,
  getReceiptScanMode,
  setReceiptScanMode,
  ReceiptScanMode,
  ExtractedReceiptItem,
  ExtractedReceiptData,
  fetchImageFromUrl,
  editOrListItemsWithGemini,
} from '@/lib/receipt-scanner';
import {
  isVoiceRecognitionSupported,
  parseVoiceOffline,
  parseVoiceWithGemini,
} from '@/lib/voice-input';

export interface TransactionSubmitData {
  account_id?: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: string;
  payment_method: string;
  note: string;
  receipt_image?: string;
  date: string;
  is_recurring?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionSubmitData) => Promise<void>;
  onBatchSubmit?: (items: Array<TransactionSubmitData>) => Promise<void>;
  onDelete?: (id: string) => void;
  categories: Category[];
  accounts?: SubAccount[];
  defaultAccountId?: string;
  currency: string;
  initialData?: Transaction | null;
  initialType?: 'income' | 'expense';
  prefillAmount?: number | null;
  prefillNote?: string;
  onCreateCategory?: (name: string, type: 'income' | 'expense') => Promise<Category>;
  autoScanOnMount?: boolean;
  onResetAutoScan?: () => void;
  autoVoiceOnMount?: boolean;
  onResetAutoVoice?: () => void;
  autoAiChatOnMount?: boolean;
  onResetAutoAiChat?: () => void;
  onNavigateToAiSettings?: () => void;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSubmit,
  onBatchSubmit,
  onDelete,
  categories,
  accounts = [],
  defaultAccountId,
  currency,
  initialData,
  initialType = 'expense',
  prefillAmount = null,
  prefillNote = '',
  onCreateCategory,
  autoScanOnMount = false,
  onResetAutoScan,
  autoVoiceOnMount = false,
  onResetAutoVoice,
  autoAiChatOnMount = false,
  onResetAutoAiChat,
  onNavigateToAiSettings,
}: TransactionModalProps) {
  const [type, setType] = useState<'income' | 'expense'>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [note, setNote] = useState<string>('');
  const [date, setDate] = useState<string>(formatLocalDate(new Date()));
  const [time, setTime] = useState<string>(getCurrentTimeInputValue());
  const symbol = getCurrencySymbol(currency);
  const { inLabel, outLabel } = useFlowLabels();

  // Secondary / more options (hidden by default to keep modal minimal)
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Category Searchable Dropdown state
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Calculator state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcLiveResult, setCalcLiveResult] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Smart Receipt Scanner state
  const [scanMode, setScanMode] = useState<ReceiptScanMode>(() => getReceiptScanMode());
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanSuccessBanner, setScanSuccessBanner] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(() => getGeminiApiKey());
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingScanTargetRef = useRef<'camera' | 'gallery'>('camera');
  const [showScannerBox, setShowScannerBox] = useState(false);
  const [scannerTab, setScannerTab] = useState<'camera' | 'gallery' | 'link'>('camera');
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isInsecureContext, setIsInsecureContext] = useState(false);
  const [httpsProxyUrl, setHttpsProxyUrl] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isLoadingImageFromLink, setIsLoadingImageFromLink] = useState(false);

  // Receipt breakdown state (Grand Total vs Individual Items)
  const [receiptBreakdown, setReceiptBreakdown] = useState<ExtractedReceiptData | null>(null);
  const [breakdownItems, setBreakdownItems] = useState<ExtractedReceiptItem[]>([]);
  const [entryMode, setEntryMode] = useState<'total' | 'individual'>('total');

  const formScrollRef = useRef<HTMLDivElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportTop, setViewportTop] = useState<number>(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Voice Input state
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Gemini AI Chatbox state (List or Edit items)
  const [showAiChat, setShowAiChat] = useState(false);
  const [showAiTips, setShowAiTips] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isListeningAiVoice, setIsListeningAiVoice] = useState(false);
  const [aiLastReply, setAiLastReply] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);
  const [aiPreviousSnapshot, setAiPreviousSnapshot] = useState<{
    items: ExtractedReceiptItem[];
    amount: string;
    note: string;
  } | null>(null);

  // Check secure context for camera streaming
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSec = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setIsInsecureContext(!isSec);
      if (window.location.protocol === 'http:') {
        setHttpsProxyUrl(`https://${window.location.hostname}:18443`);
      }
    }
  }, [isOpen]);

  // Dynamic visual viewport height tracker for seamless keyboard adaptation on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateHeight = () => {
      if (typeof window === 'undefined') return;
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        const vt = window.visualViewport.offsetTop;
        setViewportHeight(vh);
        setViewportTop(vt);
        setIsKeyboardOpen(vh < window.innerHeight * 0.78);
      } else {
        setViewportHeight(window.innerHeight);
        setViewportTop(0);
        setIsKeyboardOpen(false);
      }
    };

    updateHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);
    } else {
      window.addEventListener('resize', updateHeight);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateHeight);
        window.visualViewport.removeEventListener('scroll', updateHeight);
      } else {
        window.removeEventListener('resize', updateHeight);
      }
    };
  }, [isOpen]);

  // Keep the category dropdown fully visible inside the scrollable body
  useEffect(() => {
    if (!isCategoryDropdownOpen) return;
    const raf = requestAnimationFrame(() => {
      formScrollRef.current
        ?.querySelector('[data-category-dropdown]')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [isCategoryDropdownOpen]);

  // Immediate synchronized focus so both the modal and the mobile keyboard appear at the exact same time
  useEffect(() => {
    if (!isOpen) {
      setIsAmountFocused(false);
      return;
    }

    setIsAmountFocused(true);

    // Immediate synchronous focus on mount
    if (amountInputRef.current) {
      try {
        amountInputRef.current.focus({ preventScroll: true });
        if (amountInputRef.current.value) {
          amountInputRef.current.select();
        }
      } catch { }
    }

    // Secondary frame check to ensure mobile keyboards trigger synchronously
    const raf = requestAnimationFrame(() => {
      if (amountInputRef.current) {
        try {
          amountInputRef.current.focus({ preventScroll: true });
        } catch { }
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(String(initialData.amount));
      setAccountId(initialData.account_id || defaultAccountId || (accounts[0]?.id ?? ''));
      setCategoryId(initialData.category_id);
      setPaymentMethod(initialData.payment_method || 'Cash');
      setNote(initialData.note || '');
      setReceiptImage(initialData.receipt_image || '');

      setDate(formatLocalDate(initialData.date));

      // Extract time intelligently: check initialData.date then created_at
      let extractedTime = '';
      if (hasExplicitTime(initialData.date)) {
        const txDate = new Date(initialData.date);
        if (!isNaN(txDate.getTime())) {
          extractedTime = `${String(txDate.getHours()).padStart(2, '0')}:${String(txDate.getMinutes()).padStart(2, '0')}`;
        }
      } else if (hasExplicitTime(initialData.created_at)) {
        const createDate = new Date(initialData.created_at);
        if (!isNaN(createDate.getTime())) {
          extractedTime = `${String(createDate.getHours()).padStart(2, '0')}:${String(createDate.getMinutes()).padStart(2, '0')}`;
        }
      }
      setTime(extractedTime || getCurrentTimeInputValue());

      setIsRecurring(false);
      setShowMoreOptions(!!initialData.receipt_image);
      setIsCategoryDropdownOpen(false);
      setCategorySearch('');
    } else {
      setType(initialType);
      setAmount(prefillAmount && prefillAmount > 0 ? String(prefillAmount) : '');
      setAccountId(defaultAccountId && defaultAccountId !== 'all' ? defaultAccountId : (accounts[0]?.id ?? ''));
      setPaymentMethod('Cash');
      setNote(prefillNote || '');
      setReceiptImage('');
      setDate(formatLocalDate(new Date()));
      setTime(getCurrentTimeInputValue());
      setIsRecurring(false);
      setShowMoreOptions(false);
      setIsCategoryDropdownOpen(false);
      setCategorySearch('');
      setIsCalculatorOpen(false);
      setCalcExpression('');
      setCalcLiveResult(null);
      setError('');
      setReceiptBreakdown(null);
      setBreakdownItems([]);
      setEntryMode('total');
    }
  }, [initialData, accounts, defaultAccountId, isOpen, initialType, prefillAmount, prefillNote]);

  // Live calculator calculation
  useEffect(() => {
    if (!calcExpression.trim()) {
      setCalcLiveResult(null);
      return;
    }
    const evaluated = evaluateMathExpression(calcExpression);
    if (evaluated !== null) {
      setCalcLiveResult(String(evaluated));
    } else {
      setCalcLiveResult(null);
    }
  }, [calcExpression]);

  // Sync category with active type
  useEffect(() => {
    const available = categories.filter((c) => c.type === type);
    if (available.length > 0 && (!categoryId || !available.some((c) => c.id === categoryId))) {
      setCategoryId(available[0].id);
    }
  }, [type, categories, categoryId]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    return categories
      .filter((c) => c.type === type)
      .filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [categories, type, categorySearch]);

  // Calculator helper functions
  const evaluateMathExpression = (expr: string): number | null => {
    try {
      if (!expr || !expr.trim()) return null;
      let sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/%/g, '*0.01');

      if (!/^[0-9+\-*/.() ]+$/.test(sanitized)) {
        return null;
      }
      sanitized = sanitized.trim().replace(/[+\-*/.]+$/, '');
      if (!sanitized) return null;

      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round((result + Number.EPSILON) * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleCalcToggle = () => {
    if (!isCalculatorOpen) {
      if (amount && !isNaN(Number(amount)) && Number(amount) > 0) {
        setCalcExpression(amount);
      } else {
        setCalcExpression('');
      }
      setShowAiChat(false);
      setShowAiTips(false);
      setShowScannerBox(false);
    }
    setIsCalculatorOpen((prev) => !prev);
  };

  const handleCalcAppend = (char: string) => {
    setCalcExpression((prev) => {
      const isOperator = ['+', '-', '×', '÷', '%'].includes(char);
      if (!prev) {
        if (isOperator) return '';
        return char;
      }
      const lastChar = prev.slice(-1);
      const isLastOperator = ['+', '-', '×', '÷'].includes(lastChar);
      if (isOperator && isLastOperator) {
        return prev.slice(0, -1) + char;
      }
      return prev + char;
    });
  };

  const handleCalcClear = () => {
    setCalcExpression('');
  };

  const handleCalcDelete = () => {
    setCalcExpression((prev) => (prev ? prev.slice(0, -1) : ''));
  };

  const handleCalcEquals = () => {
    const evaluated = evaluateMathExpression(calcExpression);
    if (evaluated !== null) {
      setCalcExpression(String(evaluated));
    }
  };

  const handleCalcApply = () => {
    const evaluated = evaluateMathExpression(calcExpression);
    if (evaluated !== null) {
      setAmount(String(evaluated));
    } else if (calcExpression.trim() && !isNaN(Number(calcExpression.trim()))) {
      setAmount(calcExpression.trim());
    }
    setIsCalculatorOpen(false);
  };

  if (!isOpen) return null;

  const triggerInstantCamera = () => {
    pendingScanTargetRef.current = 'camera';
    const mode = getReceiptScanMode();
    setScanMode(mode);
    if (mode === 'offline') {
      cameraFileInputRef.current?.click();
      return;
    }
    if (!hasGeminiApiKey()) {
      setTempApiKey(getGeminiApiKey());
      setShowApiKeyModal(true);
      return;
    }
    cameraFileInputRef.current?.click();
  };

  const triggerGalleryPicker = () => {
    pendingScanTargetRef.current = 'gallery';
    const mode = getReceiptScanMode();
    setScanMode(mode);
    if (mode === 'offline') {
      galleryFileInputRef.current?.click();
      return;
    }
    if (!hasGeminiApiKey()) {
      setTempApiKey(getGeminiApiKey());
      setShowApiKeyModal(true);
      return;
    }
    galleryFileInputRef.current?.click();
  };

  const handleTriggerReceiptScan = () => {
    setShowScannerBox(true);
    setScannerTab('camera');
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      setIsStartingCamera(true);

      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      if (!nav) {
        setIsStartingCamera(false);
        setCameraError('Browser environment not available');
        return;
      }

      // Check if mediaDevices is supported
      if (!nav.mediaDevices || !nav.mediaDevices.getUserMedia) {
        setIsStartingCamera(false);
        if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          setIsInsecureContext(true);
        } else {
          setCameraError('Camera stream not supported in this browser context.');
        }
        return;
      }

      // Try multiple video constraints in order of preference (environment back-camera first)
      const constraintsList = [
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: { facingMode: 'environment' }, audio: false },
        { video: true, audio: false },
        { video: { facingMode: 'user' }, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastErr: any = null;

      for (const constraints of constraintsList) {
        try {
          stream = await nav.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (!stream) {
        setIsStartingCamera(false);
        if (lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError') {
          setCameraError('Camera permission was denied. Please allow camera access in browser address bar.');
        } else {
          setCameraError(lastErr?.message || 'Could not start camera.');
        }
        return;
      }

      setCameraStream(stream);

      // Directly attach stream to video element and start playback
      if (cameraVideoRef.current) {
        const video = cameraVideoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        try {
          await video.play();
        } catch (playErr) {
          console.warn('Video play interrupted:', playErr);
        }
      }
      setIsStartingCamera(false);
    } catch (err: any) {
      setIsStartingCamera(false);
      setCameraError(err?.message || 'Failed to start camera');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setIsStartingCamera(false);
  };

  useEffect(() => {
    if (showScannerBox && scannerTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showScannerBox, scannerTab]);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      const video = cameraVideoRef.current;
      video.srcObject = cameraStream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.play().catch(() => { });
    }
  }, [cameraStream, scannerTab]);

  const captureLivePhoto = async () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    setShowScannerBox(false);

    setIsScanningReceipt(true);
    setError('');
    setScanSuccessBanner(null);
    try {
      triggerHaptic('medium');
      setReceiptImage(dataUrl);
      setShowMoreOptions(true);

      const extracted = await scanReceiptSmart(dataUrl, categories, symbol);
      if (extracted.amount && extracted.amount > 0) setAmount(String(extracted.amount));
      if (extracted.note) setNote(extracted.note);
      if (extracted.date) setDate(extracted.date);
      if (extracted.time) setTime(extracted.time);
      if (extracted.categoryId) setCategoryId(extracted.categoryId);
      if (extracted.paymentMethod) setPaymentMethod(extracted.paymentMethod);
      setReceiptBreakdown(extracted);
      setBreakdownItems(extracted.items || []);
      setEntryMode(extracted.items && extracted.items.length > 1 ? 'individual' : 'total');
      triggerHaptic('success');
      setScanSuccessBanner(
        extracted.items && extracted.items.length > 0
          ? `Receipt analyzed! Found ${extracted.items.length} items.`
          : 'Receipt photo captured & attached!'
      );
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 200);
    } catch (err: any) {
      triggerHaptic('warning');
      setError(err.message || 'Scan failed.');
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleSaveApiKeyAndScan = () => {
    if (!tempApiKey.trim()) {
      setError('Please paste a valid Gemini API Key from Google AI Studio.');
      return;
    }
    setGeminiApiKey(tempApiKey.trim());
    setReceiptScanMode('ai');
    setScanMode('ai');
    setShowApiKeyModal(false);
    setError('');
    triggerHaptic('success');
    setTimeout(() => {
      if (pendingScanTargetRef.current === 'gallery') {
        galleryFileInputRef.current?.click();
      } else {
        cameraFileInputRef.current?.click();
      }
    }, 150);
  };

  const handleScanFromLink = async (targetUrl?: string) => {
    const rawUrl = (targetUrl || imageUrlInput).trim();
    if (!rawUrl) {
      setError('Please enter or paste an image URL to scan.');
      return;
    }
    setIsLoadingImageFromLink(true);
    setIsScanningReceipt(true);
    setError('');
    setScanSuccessBanner(null);

    try {
      triggerHaptic('medium');
      const { dataUrl } = await fetchImageFromUrl(rawUrl);
      setReceiptImage(dataUrl);
      setShowMoreOptions(true);
      setShowScannerBox(false);

      // Run smart scan on the downloaded image
      const extracted = await scanReceiptSmart(dataUrl, categories, symbol);
      if (extracted.amount && extracted.amount > 0) setAmount(String(extracted.amount));
      if (extracted.note) setNote(extracted.note);
      if (extracted.date) setDate(extracted.date);
      if (extracted.time) setTime(extracted.time);
      if (extracted.categoryId) setCategoryId(extracted.categoryId);
      if (extracted.paymentMethod) setPaymentMethod(extracted.paymentMethod);
      setReceiptBreakdown(extracted);
      setBreakdownItems(extracted.items || []);
      setEntryMode(extracted.items && extracted.items.length > 1 ? 'individual' : 'total');
      triggerHaptic('success');
      setScanSuccessBanner(
        extracted.items && extracted.items.length > 0
          ? `Receipt analyzed from link! Found ${extracted.items.length} items.`
          : 'Receipt image loaded from link successfully!'
      );

      // Auto focus amount field
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 200);
    } catch (err: any) {
      triggerHaptic('warning');
      if (err.message === 'CONFIG_AI_IN_SETTINGS' || err.message === 'MISSING_GEMINI_API_KEY' || err.message === 'INVALID_GEMINI_API_KEY') {
        setShowApiKeyModal(true);
        setError(
          err.message === 'INVALID_GEMINI_API_KEY'
            ? 'Your Gemini API Key is invalid or expired. Please update it.'
            : 'Configure your free Google Gemini API Key or tap "Scan Without AI".'
        );
      } else {
        setError(err.message || 'Failed to scan image from link.');
      }
    } finally {
      setIsLoadingImageFromLink(false);
      setIsScanningReceipt(false);
    }
  };

  const handlePasteLinkFromClipboard = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          setImageUrlInput(text.trim());
          triggerHaptic('light');
        }
      }
    } catch {
      // Ignore clipboard read denial
    }
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);
    setError('');
    setScanSuccessBanner(null);

    // 1. Immediately compress & attach the photo preview so the image is ALWAYS saved instantly
    try {
      const compressed = await compressImageForOcr(file, 1600, 0.85);
      if (compressed?.dataUrl) {
        setReceiptImage(compressed.dataUrl);
        setShowMoreOptions(true);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = ev.target?.result as string;
        if (res) {
          setReceiptImage(res);
          setShowMoreOptions(true);
        }
      };
      reader.readAsDataURL(file);
    }

    try {
      triggerHaptic('medium');
      const extracted = await scanReceiptSmart(file, categories, symbol);

      // Smartly update all form fields
      if (extracted.amount && extracted.amount > 0) {
        setAmount(String(extracted.amount));
      }
      if (extracted.type) {
        setType(extracted.type);
      }
      if (extracted.note) {
        setNote(extracted.note);
      }
      if (extracted.date) {
        setDate(extracted.date);
      }
      if (extracted.time) {
        setTime(extracted.time);
      }
      if (extracted.categoryId) {
        setCategoryId(extracted.categoryId);
      }
      if (extracted.paymentMethod) {
        setPaymentMethod(extracted.paymentMethod);
      }
      if (extracted.receiptImage) {
        setReceiptImage(extracted.receiptImage);
      }

      // Save breakdown details
      setReceiptBreakdown(extracted);
      setBreakdownItems(extracted.items || []);
      const isUnpricedList = extracted.items && extracted.items.length > 0 && (!extracted.amount || extracted.amount === 0);
      setEntryMode(isUnpricedList ? 'individual' : 'total');

      triggerHaptic('success');
      if (extracted.isOffline) {
        setScanSuccessBanner(
          extracted.items && extracted.items.length > 0
            ? `Offline Scan: ${extracted.items.length} items detected from receipt/note`
            : 'Receipt photo attached successfully (Without AI / Offline Mode)'
        );
      } else {
        const storeLabel = extracted.merchant ? ` from ${extracted.merchant}` : '';
        const catLabel = extracted.categoryName ? ` (${extracted.categoryName})` : '';
        const itemsLabel = extracted.items && extracted.items.length > 0 ? ` • ${extracted.items.length} items detected` : '';
        if (isUnpricedList) {
          setScanSuccessBanner(`Smart Extracted ${extracted.items.length} shopping list items${storeLabel}${catLabel}`);
        } else {
          setScanSuccessBanner(`Smart Extracted ${symbol}${extracted.amount}${storeLabel}${catLabel}${itemsLabel}`);
        }
      }

      // Auto-focus amount field so user can verify
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 200);
    } catch (err: any) {
      triggerHaptic('warning');
      if (err.message === 'CONFIG_AI_IN_SETTINGS' || err.message === 'MISSING_GEMINI_API_KEY' || err.message === 'INVALID_GEMINI_API_KEY') {
        setShowApiKeyModal(true);
        setError(
          err.message === 'INVALID_GEMINI_API_KEY'
            ? 'Your Gemini API Key is invalid or expired. Please update it.'
            : 'Configure your free Google Gemini API Key or tap "Scan Without AI".'
        );
      } else {
        setScanSuccessBanner('Photo attached successfully! (Enter transaction details manually)');
      }
    } finally {
      setIsScanningReceipt(false);
      if (cameraFileInputRef.current) {
        cameraFileInputRef.current.value = '';
      }
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = '';
      }
    }
  };

  const handleSwitchToAiAndRescan = async () => {
    setReceiptScanMode('ai');
    setScanMode('ai');
    if (!hasGeminiApiKey()) {
      setTempApiKey(getGeminiApiKey());
      setShowApiKeyModal(true);
      return;
    }
    const targetImage = receiptImage;
    if (!targetImage) {
      triggerInstantCamera();
      return;
    }

    setIsScanningReceipt(true);
    setError('');
    try {
      triggerHaptic('medium');
      const extracted = await scanReceiptWithGemini(targetImage, categories, symbol);
      if (extracted.amount && extracted.amount > 0) setAmount(String(extracted.amount));
      if (extracted.note) setNote(extracted.note);
      if (extracted.date) setDate(extracted.date);
      if (extracted.categoryId) setCategoryId(extracted.categoryId);
      setReceiptBreakdown(extracted);
      setBreakdownItems(extracted.items || []);
      setEntryMode('individual');
      setScanSuccessBanner(`Gemini AI Extracted ${extracted.items.length} handwritten items with 100% accuracy!`);
      triggerHaptic('success');
    } catch (err: any) {
      if (err.message === 'CONFIG_AI_IN_SETTINGS' || err.message === 'MISSING_GEMINI_API_KEY' || err.message === 'INVALID_GEMINI_API_KEY') {
        setShowApiKeyModal(true);
      } else {
        setError(err?.message || 'Failed to scan with Gemini AI');
      }
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleToggleItemSelect = (id: string, selected: boolean) => {
    triggerHaptic('light');
    setBreakdownItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected } : it))
    );
  };

  const handleUpdateItemField = (id: string, field: 'name' | 'price' | 'category_id', value: any) => {
    setBreakdownItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: value };
          if (field === 'category_id') {
            const cat = categories.find((c) => c.id === value);
            if (cat) updated.category_name = cat.name;
          }
          return updated;
        }
        return it;
      })
    );
  };

  const handleRemoveBreakdownItem = (id: string) => {
    triggerHaptic('light');
    setBreakdownItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddBreakdownItem = () => {
    triggerHaptic('light');
    const defaultCat = categories.find((c) => c.type === type) || categories[0];
    const newItem: ExtractedReceiptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      price: 0,
      category_id: defaultCat?.id,
      category_name: defaultCat?.name,
      selected: true,
    };
    setBreakdownItems((prev) => [...prev, newItem]);
  };

  const selectedItems = breakdownItems.filter((it) => it.selected !== false);
  const selectedItemsCount = selectedItems.length;
  const selectedItemsTotal = breakdownItems
    .filter((it) => it.selected !== false)
    .reduce((sum, it) => sum + (it.price || 0), 0);

  const handleAddToShoppingList = () => {
    if (selectedItems.length === 0) {
      setError('Please select at least one item from the list');
      return;
    }
    try {
      const existingRaw = typeof window !== 'undefined' ? localStorage.getItem('cashflow_shopping_list') : null;
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const newItems = selectedItems.map((it, idx) => ({
        id: 'shop_' + Date.now() + '_' + idx,
        name: it.name,
        quantity: '1',
        estimated_price: it.price > 0 ? it.price : undefined,
        priority: 'normal' as const,
        is_bought: false,
        created_at: new Date().toISOString(),
      }));
      const merged = [...newItems, ...existingList];
      if (typeof window !== 'undefined') {
        localStorage.setItem('cashflow_shopping_list', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('cashflow:shopping-updated'));
      }
      triggerHaptic('success');
      setScanSuccessBanner(`Added ${newItems.length} items to your In-App Shopping List!`);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to add items to shopping list');
    }
  };

  const handleSendAiChat = async (customPrompt?: string) => {
    const textToRun = (customPrompt || aiChatInput).trim();
    if (!textToRun) return;

    if (!hasGeminiApiKey()) {
      setShowApiKeyModal(true);
      return;
    }

    setAiErrorMessage(null);
    setIsAiThinking(true);
    triggerHaptic('light');

    // Snapshot current state for one-click Undo
    setAiPreviousSnapshot({
      items: breakdownItems.map((it) => ({ ...it })),
      amount,
      note,
    });

    try {
      const res = await editOrListItemsWithGemini({
        userPrompt: textToRun,
        currentItems: breakdownItems,
        currentAmount: parseFloat(amount) || 0,
        currentNote: note,
        categories: categories.filter((c) => c.type === type),
        userCurrency: symbol || currency || 'BDT',
      });

      if (res.items && res.items.length > 0) {
        setBreakdownItems(res.items);
        setEntryMode('individual');
        if (res.amount > 0) {
          setAmount(String(res.amount));
        }
      }
      if (res.note) {
        setNote(res.note);
      }
      setAiLastReply(res.replyMessage || `Updated ${res.items?.length || 0} items`);
      setAiChatInput('');
      triggerHaptic('success');
    } catch (err: any) {
      if (err?.message === 'INVALID_GEMINI_API_KEY') {
        setShowApiKeyModal(true);
        setAiErrorMessage('Invalid Gemini API Key. Please update your key in Settings.');
      } else {
        setAiErrorMessage(err?.message || 'Failed to update items with AI.');
      }
      triggerHaptic('warning');
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleUndoAiEdit = () => {
    if (!aiPreviousSnapshot) return;
    setBreakdownItems(aiPreviousSnapshot.items);
    setAmount(aiPreviousSnapshot.amount);
    setNote(aiPreviousSnapshot.note);
    setAiPreviousSnapshot(null);
    setAiLastReply('Reverted to previous items.');
    triggerHaptic('light');
  };

  const handleToggleAiVoiceInput = () => {
    if (isListeningAiVoice) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { }
      }
      setIsListeningAiVoice(false);
      return;
    }

    if (!isVoiceRecognitionSupported()) {
      setAiErrorMessage('Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';

    recognition.onstart = () => {
      setIsListeningAiVoice(true);
      setAiErrorMessage(null);
      triggerHaptic('medium');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (!transcript.trim()) return;

      setIsListeningAiVoice(false);
      triggerHaptic('success');
      setAiChatInput(transcript);

      // Automatically send spoken instruction to Gemini AI to add, remove, or edit items!
      await handleSendAiChat(transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListeningAiVoice(false);
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isHttp) {
          setAiErrorMessage(`Microphone access blocked: Mobile browsers require HTTPS for speech recognition. Open via HTTPS: https://${window.location.hostname}:18443`);
        } else {
          setAiErrorMessage('Microphone permission not allowed. Please tap the lock (🔒) icon in your browser address bar and set Microphone to "Allow".');
        }
      } else {
        setAiErrorMessage(`Voice error: ${event.error || 'Failed to capture voice'}`);
      }
    };

    recognition.onend = () => {
      setIsListeningAiVoice(false);
    };

    try {
      recognition.start();
    } catch {
      setIsListeningAiVoice(false);
      setAiErrorMessage('Could not access microphone.');
    }
  };

  const handleSaveAllIndividualProducts = async () => {
    if (selectedItems.length === 0) {
      setError('Please select at least one item from the list');
      return;
    }

    const defaultExpenseCat = categories.find((c) => c.type === type && /other|product|service|general/i.test(c.name))
      || categories.find((c) => c.type === type)
      || categories[0];

    const finalIso = combineDateAndTime(date, time);
    const itemsToSave = selectedItems.map((it) => {
      let finalCatId = it.category_id;
      if (!finalCatId || finalCatId === 'uncategorized') {
        finalCatId = defaultExpenseCat?.id || categoryId;
      }
      return {
        account_id: accountId || undefined,
        amount: it.price,
        type,
        category_id: finalCatId,
        payment_method: paymentMethod,
        note: it.name || (receiptBreakdown?.merchant ? `${receiptBreakdown.merchant} item` : 'Receipt product'),
        receipt_image: receiptImage,
        date: finalIso,
        is_recurring: false,
      };
    });

    try {
      setLoading(true);
      setError('');
      if (onBatchSubmit) {
        await onBatchSubmit(itemsToSave);
      } else {
        for (const item of itemsToSave) {
          await onSubmit(item);
        }
      }
      triggerHaptic('success');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save individual products');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSingleProduct = (it: ExtractedReceiptItem) => {
    triggerHaptic('light');
    setAmount(String(it.price));
    if (it.name) {
      setNote(it.name);
    }
    if (it.category_id) {
      setCategoryId(it.category_id);
    }
    setEntryMode('total');
  };

  const handleToggleVoiceInput = () => {
    if (isListeningVoice) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { }
      }
      setIsListeningVoice(false);
      return;
    }

    if (!isVoiceRecognitionSupported()) {
      setError('Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';

    recognition.onstart = () => {
      setIsListeningVoice(true);
      setError('');
      triggerHaptic('medium');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (!transcript.trim()) return;

      setIsListeningVoice(false);
      triggerHaptic('success');

      try {
        // If Gemini API is available and transcript looks like an item/list command, OR items already exist, OR chat is open:
        const isListCommand =
          breakdownItems.length > 0 ||
          showAiChat ||
          /\b(add|remove|delete|change|edit|update|discount|list|items|item|plus|minus|drop|clear)\b/i.test(transcript) ||
          /(যোগ|বাদ|মুছে|ডিলিট|কমাও|বাড়া|পরিবর্তন|দাম|লিস্ট|আইটেম|এবং|আর)/i.test(transcript);

        if (isListCommand && hasGeminiApiKey()) {
          setShowAiChat(true);
          await handleSendAiChat(transcript);
          setScanSuccessBanner(`Voice executed on list: "${transcript}"`);
          return;
        }

        const mode = getReceiptScanMode();
        let parsed;
        if (mode === 'ai' && hasGeminiApiKey()) {
          parsed = await parseVoiceWithGemini(transcript, categories, symbol);
        } else {
          parsed = parseVoiceOffline(transcript, categories, symbol);
        }

        if (parsed.amount > 0) {
          setAmount(String(parsed.amount));
        }
        if (parsed.type) {
          setType(parsed.type);
        }
        if (parsed.categoryId) {
          setCategoryId(parsed.categoryId);
        }
        if (parsed.paymentMethod) {
          setPaymentMethod(parsed.paymentMethod);
        }
        if (parsed.note) {
          setNote(parsed.note);
        }

        setScanSuccessBanner(`Voice recognized: "${transcript}"`);
        setTimeout(() => {
          amountInputRef.current?.focus();
        }, 150);
      } catch (err: any) {
        setError('Could not parse voice command. Please try again.');
      }
    };

    recognition.onerror = (event: any) => {
      setIsListeningVoice(false);
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isHttp) {
          setError(`Microphone access blocked: Mobile browsers require HTTPS for speech recognition. Open via HTTPS: https://${window.location.hostname}:18443`);
        } else {
          setError('Microphone permission not allowed. Please tap the lock (🔒) icon in your browser address bar and set Microphone to "Allow".');
        }
      } else {
        setError(`Voice error: ${event.error || 'Failed to capture voice'}`);
      }
    };

    recognition.onend = () => {
      setIsListeningVoice(false);
    };

    try {
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  // Trigger scan immediately on mount if requested from Dashboard Quick Scan or Speed Dial
  useEffect(() => {
    if (autoScanOnMount && isOpen) {
      handleTriggerReceiptScan();
      onResetAutoScan?.();
    }
  }, [autoScanOnMount, isOpen]);

  // Trigger voice recognition immediately on mount if requested from Speed Dial
  useEffect(() => {
    if (autoVoiceOnMount && isOpen) {
      const timer = setTimeout(() => {
        handleToggleVoiceInput();
        onResetAutoVoice?.();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoVoiceOnMount, isOpen]);

  // Open Gemini AI Chatbox immediately on mount if requested from Speed Dial
  useEffect(() => {
    if (autoAiChatOnMount && isOpen) {
      setShowAiChat(true);
      onResetAutoAiChat?.();
    }
  }, [autoAiChatOnMount, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleReceiptFileChange(e);
  };

  const handleCreateNewCategory = async () => {
    if (!newCatName.trim() || !onCreateCategory) return;
    try {
      const created = await onCreateCategory(newCatName.trim(), type);
      setCategoryId(created.id);
      setNewCatName('');
      setIsCategoryDropdownOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  const handleSubmit = async (e?: React.FormEvent, shouldContinue: boolean = false) => {
    if (e) e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    const finalIso = combineDateAndTime(date, time);

    try {
      setLoading(true);
      await onSubmit({
        account_id: accountId || undefined,
        amount: numericAmount,
        type,
        category_id: categoryId,
        payment_method: paymentMethod,
        note: note.trim(),
        receipt_image: receiptImage,
        date: finalIso,
        is_recurring: isRecurring,
        frequency: frequency,
      });

      if (isRecurring && !initialData) {
        await api.createRecurring({
          amount: numericAmount,
          type,
          category_id: categoryId,
          payment_method: paymentMethod,
          note: note.trim(),
          frequency: frequency,
          start_date: finalIso,
        }).catch(() => { });
      }

      triggerHaptic('success');

      if (shouldContinue) {
        setAmount('');
        setNote('');
        setReceiptImage('');
        setBreakdownItems([]);
        setScanSuccessBanner('Saved! Ready for next transaction.');
        setTimeout(() => {
          setScanSuccessBanner(null);
          amountInputRef.current?.focus();
        }, 1200);
      } else {
        onClose();
      }
    } catch (err: any) {
      triggerHaptic('warning');
      setError(err.message || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="modal-backdrop-fade fixed inset-x-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-100"
      style={{
        top: `${viewportTop}px`,
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        maxHeight: viewportHeight ? `${viewportHeight}px` : '100dvh',
        paddingTop: isKeyboardOpen ? '4px' : 'max(calc(env(safe-area-inset-top, 0px) + 8px), 12px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="transaction-modal-sheet w-full max-w-sm sm:max-w-md flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-t-[10px] sm:rounded-t-[10px] rounded-b-none !rounded-b-none shadow-2xl overflow-hidden animate-in fade-in zoom-in-98 duration-100 border border-b-0 border-slate-100 dark:border-slate-800 gpu-layer"
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderBottomWidth: 0,
          maxHeight: viewportHeight ? `${Math.floor(viewportHeight)}px` : 'calc(100dvh - 14px)',
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          {/* 1. Header with Type Toggle & Close */}
          <div className="modal-chrome modal-chrome-top flex items-center justify-between px-4 py-2 shrink-0">
            {/* Segmented Type Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-[10px] gap-1">
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  setIsCategoryDropdownOpen(false);
                  setCategorySearch('');
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all ${type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span className="truncate">{outLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  setIsCategoryDropdownOpen(false);
                  setCategorySearch('');
                }}
                style={type === 'income' ? { backgroundColor: '#059669', color: '#ffffff' } : undefined}
                className={`modal-cash-in-tab flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all ${type === 'income'
                  ? '!bg-emerald-600 !text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span className="truncate">{inLabel}</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-[6px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Scrollable Form Body */}
          <div
            ref={formScrollRef}
            className="px-4 pt-3 pb-3 space-y-2.5 overflow-y-auto overscroll-contain flex-1 min-h-0 touch-pan-y"
            style={{
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Hidden Input for Instant Camera Capture */}
            <input
              ref={cameraFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptFileChange}
              className="hidden"
            />

            {/* Hidden Input for Photo Gallery / Albums */}
            <input
              ref={galleryFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptFileChange}
              className="hidden"
            />

            {error && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div>{error}</div>
                  {httpsProxyUrl && error.includes('HTTPS') && (
                    <a
                      href={httpsProxyUrl}
                      className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <span>Open via Secure HTTPS ({httpsProxyUrl})</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                {!hasGeminiApiKey() && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempApiKey(getGeminiApiKey());
                      setShowApiKeyModal(true);
                    }}
                    className="shrink-0 px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    Enable AI (Free)
                  </button>
                )}
              </div>
            )}

            {/* Smart Gemini Scan Status Banner */}
            {isScanningReceipt && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold">Analyzing receipt with Gemini AI...</div>
                  <div className="text-[11px] opacity-80 truncate">Detecting total amount, merchant, date &amp; category</div>
                </div>
              </div>
            )}

            {/* Smart Scan Success Badge */}
            {scanSuccessBanner && !isScanningReceipt && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate font-semibold">{scanSuccessBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScanSuccessBanner(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] font-bold shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Low Confidence / Handwriting Alert in Offline Mode */}
            {receiptBreakdown?.isLowConfidence && !isScanningReceipt && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Handwritten Note or Unclear Text (Offline Mode)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Offline scanner cannot decipher cursive handwriting on notebook paper. For 100% accurate conversion, scan with <strong>Google Gemini AI</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleSwitchToAiAndRescan}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Scan with Gemini AI (100% Handwriting Accuracy)</span>
                </button>
              </div>
            )}

            {/* Receipt Breakdown & Mode Selector Card (Total vs Every Product Individually) */}
            {(receiptBreakdown || breakdownItems.length > 0) && !isScanningReceipt && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {receiptImage ? (
                      <img src={receiptImage} alt="Receipt thumbnail" className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {(receiptBreakdown && receiptBreakdown.merchant) || 'Itemized Products / Services'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {breakdownItems.length} products/services • Grand Total: <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{symbol}{(receiptBreakdown ? receiptBreakdown.amount : selectedItemsTotal).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptBreakdown(null);
                      setBreakdownItems([]);
                    }}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                  >
                    Dismiss
                  </button>
                </div>

                {/* Entry Mode Switcher: Record as Total vs Record Every Product Individually */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-900/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setEntryMode('total');
                      if (receiptBreakdown && receiptBreakdown.amount > 0) {
                        setAmount(String(receiptBreakdown.amount));
                      } else if (selectedItemsTotal > 0) {
                        setAmount(String(selectedItemsTotal));
                      }
                    }}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${entryMode === 'total'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">Record as Total</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setEntryMode('individual');
                    }}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${entryMode === 'individual'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    <ListChecks className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate">Every Product ({breakdownItems.length})</span>
                  </button>
                </div>

                {/* Individual Products Breakdown Table */}
                {entryMode === 'individual' && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-0.5">
                      <span>Products / Services List</span>
                      <span>Selected: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{symbol}{selectedItemsTotal.toFixed(2)}</strong></span>
                    </div>

                    {/* Unpriced Shopping List Alert */}
                    {selectedItemsTotal === 0 && breakdownItems.length > 0 && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] flex items-start gap-1.5 leading-snug animate-in fade-in duration-150">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Unpriced Checklist / Shopping List detected:</strong> Enter prices below to record expenses, or tap &ldquo;Export to Shopping List&rdquo; below to track them as a shopping checklist!
                        </span>
                      </div>
                    )}

                    {/* Batch Category Selector for all items */}
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Set category for all:</span>
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          const cat = categories.find((c) => c.id === val);
                          setBreakdownItems((prev) =>
                            prev.map((it) => ({
                              ...it,
                              category_id: val || '',
                              category_name: cat ? cat.name : 'Products & Services',
                            }))
                          );
                          triggerHaptic('light');
                        }}
                        defaultValue=""
                        className="py-1 px-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer max-w-[170px] truncate"
                      >
                        <option value="">Choose category...</option>
                        <option value="uncategorized">📦 Products & Services (Uncategorized)</option>
                        {filteredCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-700/60">
                      {breakdownItems.map((item, index) => (
                        <div key={item.id || index} className="pt-1.5 first:pt-0 flex items-center gap-1 sm:gap-1.5">
                          <input
                            type="checkbox"
                            checked={item.selected !== false}
                            onChange={(e) => handleToggleItemSelect(item.id, e.target.checked)}
                            className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                            title="Include in entry"
                          />

                          {/* Name / Description Input - Maximized Space */}
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItemField(item.id, 'name', e.target.value)}
                            placeholder="Description..."
                            className="flex-1 min-w-0 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                          />

                          {/* Reduced Compact Price Input */}
                          <div className="relative w-14 sm:w-16 shrink-0">
                            <span className="absolute left-1 top-1 text-[10px] text-slate-400 font-mono font-bold">{symbol}</span>
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={item.price || ''}
                              onChange={(e) => handleUpdateItemField(item.id, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full pl-3 pr-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 text-right"
                            />
                          </div>

                          {/* Compact Category Dropdown */}
                          <select
                            value={item.category_id || ''}
                            onChange={(e) => handleUpdateItemField(item.id, 'category_id', e.target.value)}
                            className="w-[72px] sm:w-24 py-1 px-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none truncate cursor-pointer shrink-0"
                          >
                            <option value="">📦 General</option>
                            {filteredCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => handleRemoveBreakdownItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Product & Edit with AI Chat & Selection Summary */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleAddBreakdownItem}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Product</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!hasGeminiApiKey()) {
                              setShowApiKeyModal(true);
                            } else {
                              setShowAiChat(true);
                            }
                            triggerHaptic('light');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Edit with AI Chat</span>
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {selectedItemsCount} of {breakdownItems.length} selected
                      </span>
                    </div>

                    {/* Action Buttons for Scanned Products */}
                    <div className="pt-1.5 space-y-1.5">
                      <button
                        type="button"
                        onClick={handleSaveAllIndividualProducts}
                        disabled={loading || selectedItemsCount === 0}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                        <span>
                          Save All {selectedItemsCount} Items Individually ({symbol}{selectedItemsTotal.toFixed(2)})
                        </span>
                      </button>

                      {/* Export to In-App Shopping List */}
                      <button
                        type="button"
                        onClick={handleAddToShoppingList}
                        disabled={selectedItemsCount === 0}
                        className="w-full py-2 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.99]"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Export {selectedItemsCount} Items to Shopping List (/shopping)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Amount Hero Display: Full Width Card with Embedded Action Icons */}
            <div className="pt-1 pb-1">
              <div
                onClick={() => amountInputRef.current?.focus()}
                className="modal-field w-full flex items-center justify-between relative cursor-text py-2 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 rounded-[10px] transition-all hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs"
              >
                {/* Left / Center: Currency & Amount Input */}
                <div className="flex items-center flex-1 min-w-0 mr-2">
                  <span className={`text-2xl sm:text-3xl font-extrabold font-mono mr-1 select-none transition-colors shrink-0 ${type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                    {type === 'income' ? '+' : '-'}{symbol}
                  </span>
                  <input
                    ref={amountInputRef}
                    autoFocus
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={() => setIsAmountFocused(true)}
                    onBlur={() => setIsAmountFocused(false)}
                    placeholder="0.00"
                    className={`text-2xl sm:text-3xl font-black font-mono bg-transparent outline-none w-full min-w-0 tracking-tight transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400 placeholder-emerald-300/40 dark:placeholder-emerald-800/40'
                      : 'text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700'
                      }`}
                    required
                  />
                </div>

                {/* Right: Embedded Action Icons inside the Amount Container */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 shrink-0 pl-1.5 border-l border-slate-200 dark:border-slate-700/80"
                >
                  {/* Calc Button */}
                  <button
                    type="button"
                    onClick={handleCalcToggle}
                    title={isCalculatorOpen ? 'Close calculator' : 'Open calculator to compute amount'}
                    className={`w-7 h-7 rounded-[6px] flex items-center justify-center transition-all active:scale-95 ${isCalculatorOpen
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>

                  {/* Voice Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isListeningVoice) {
                        setIsCalculatorOpen(false);
                        setShowAiChat(false);
                        setShowAiTips(false);
                        setShowScannerBox(false);
                      }
                      handleToggleVoiceInput();
                    }}
                    title={isListeningVoice ? 'Listening... tap to stop' : 'Voice Entry: Speak your transaction'}
                    className={`w-7 h-7 rounded-[6px] flex items-center justify-center transition-all active:scale-95 ${isListeningVoice
                      ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-400'
                      : 'text-indigo-500 dark:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    {isListeningVoice ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Scan Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCalculatorOpen(false);
                      setShowAiChat(false);
                      setShowAiTips(false);
                      setShowScannerBox(true);
                      setScannerTab('camera');
                    }}
                    disabled={isScanningReceipt}
                    title="Smart Receipt Scanner (Camera, Gallery, Link)"
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center transition-all active:scale-95 text-amber-500 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 disabled:opacity-50"
                  >
                    {isScanningReceipt ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* AI Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasGeminiApiKey()) {
                        setShowApiKeyModal(true);
                      } else {
                        setShowAiChat((prev) => {
                          const next = !prev;
                          if (next) {
                            setIsCalculatorOpen(false);
                            setShowScannerBox(false);
                          }
                          return next;
                        });
                      }
                      triggerHaptic('light');
                    }}
                    disabled={isScanningReceipt || isAiThinking}
                    title={hasGeminiApiKey() ? "AI Assistant: Chat to list or edit items" : "Configure Gemini API for AI Chatbox"}
                    className={`w-7 h-7 rounded-[6px] flex items-center justify-center transition-all active:scale-95 ${showAiChat
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                      }`}
                  >
                    <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 ${showAiChat ? 'fill-white' : 'fill-purple-600 dark:fill-purple-400'}`}>
                      <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Gemini AI Chatbox for Listing / Editing Items */}
              {showAiChat && (
                <div className="mt-2.5 p-3 text-left bg-gradient-to-b from-purple-50/80 via-white to-indigo-50/50 dark:from-purple-950/30 dark:via-slate-900 dark:to-indigo-950/20 border border-purple-200/80 dark:border-purple-800/60 rounded-xl space-y-2.5 animate-in fade-in duration-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                          <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>Gemini AI Item Assistant</span>
                          <button
                            type="button"
                            onClick={() => setShowAiTips((v) => !v)}
                            className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors p-0.5"
                            title="Instructions & Examples"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                            AI Ready
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {breakdownItems.length > 0
                            ? `Chat to edit or reorganize ${breakdownItems.length} items`
                            : 'Chat to create and list items with prices'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAiChat(false);
                        setShowAiTips(false);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Close chatbox"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Minimal Collapsible Instructions */}
                  {showAiTips && (
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-950 dark:text-purple-200 space-y-1 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1 text-[11px]">
                          <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
                          Instructions & Examples
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAiTips(false)}
                          className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          Hide
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Type or tap mic: <code className="bg-purple-100/80 dark:bg-purple-900/40 px-1 py-0.5 rounded font-mono text-purple-700 dark:text-purple-300">Apples $4, Milk $3</code>, <code className="bg-purple-100/80 dark:bg-purple-900/40 px-1 py-0.5 rounded font-mono text-purple-700 dark:text-purple-300">10% discount all</code>, or <code className="bg-purple-100/80 dark:bg-purple-900/40 px-1 py-0.5 rounded font-mono text-purple-700 dark:text-purple-300">Remove $0 items</code>.
                      </p>
                    </div>
                  )}

                  {/* Last AI reply message / feedback */}
                  {aiLastReply && (
                    <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-purple-100 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="truncate">{aiLastReply}</span>
                      </div>
                      {aiPreviousSnapshot && (
                        <button
                          type="button"
                          onClick={handleUndoAiEdit}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
                        >
                          <Undo2 className="w-3 h-3" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* AI Error message */}
                  {aiErrorMessage && (
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div>{aiErrorMessage}</div>
                        {httpsProxyUrl && aiErrorMessage.includes('HTTPS') && (
                          <a
                            href={httpsProxyUrl}
                            className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <span>Open via Secure HTTPS ({httpsProxyUrl})</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiErrorMessage(null)}
                        className="text-rose-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Voice Listening Banner */}
                  {isListeningAiVoice && (
                    <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-rose-500 animate-bounce shrink-0" />
                        <span className="font-semibold">Listening... Speak to add, remove, or edit items</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleAiVoiceInput}
                        className="text-[11px] font-bold text-rose-700 dark:text-rose-300 underline"
                      >
                        Stop
                      </button>
                    </div>
                  )}

                  {/* Chatbox Input form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendAiChat();
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={aiChatInput}
                      onChange={(e) => setAiChatInput(e.target.value)}
                      disabled={isAiThinking}
                      placeholder={
                        breakdownItems.length > 0
                          ? "Type or tap mic: 'Add milk $3', 'Delete bread'..."
                          : "Type or tap mic: 'List 2kg apples $4, milk $3'..."
                      }
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    {/* Voice Mic Button inside AI Chatbox */}
                    <button
                      type="button"
                      onClick={handleToggleAiVoiceInput}
                      disabled={isAiThinking}
                      title={isListeningAiVoice ? "Listening... Tap to stop" : "Use microphone to speak commands (Add, Remove, Edit)"}
                      className={`p-1.5 px-2 rounded-lg border transition-all shrink-0 active:scale-95 flex items-center gap-1 ${isListeningAiVoice
                        ? 'bg-rose-500 text-white animate-pulse border-rose-600 ring-2 ring-rose-400'
                        : 'text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 border-purple-200 dark:border-purple-800'
                        }`}
                    >
                      {isListeningAiVoice ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold">Listening</span>
                        </>
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="submit"
                      disabled={isAiThinking || !aiChatInput.trim()}
                      className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-xs active:scale-95 transition-all"
                    >
                      {isAiThinking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Calculator Popup / Keypad */}
            {isCalculatorOpen && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/90 rounded-[10px] border border-slate-200 dark:border-slate-700 shadow-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                {/* Calculator Display */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[6px] p-2.5 flex flex-col items-end justify-center min-h-[50px]">
                  <div className="text-xs font-mono text-slate-400 dark:text-slate-500 tracking-wider truncate w-full text-right h-4">
                    {calcExpression || '0'}
                  </div>
                  <div className="text-base sm:text-lg font-mono font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                    {calcLiveResult !== null ? `= ${symbol}${calcLiveResult}` : `${symbol}0.00`}
                  </div>
                </div>

                {/* Keypad Grid */}
                <div className="grid grid-cols-4 gap-1.5 text-sm font-semibold select-none font-mono">
                  {/* Row 1 */}
                  <button
                    type="button"
                    onClick={handleCalcClear}
                    className="py-2.5 rounded-[6px] bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 active:scale-95 transition-all text-xs font-bold"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={handleCalcDelete}
                    className="py-2.5 rounded-[6px] bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center"
                    title="Backspace"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcAppend('%')}
                    className="py-2.5 rounded-[6px] bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all text-xs font-bold"
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcAppend('÷')}
                    className="py-2.5 rounded-[6px] bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                  >
                    ÷
                  </button>

                  {/* Row 2 */}
                  {['7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleCalcAppend(digit)}
                      className="py-2.5 rounded-[6px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleCalcAppend('×')}
                    className="py-2.5 rounded-[6px] bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                  >
                    ×
                  </button>

                  {/* Row 3 */}
                  {['4', '5', '6'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleCalcAppend(digit)}
                      className="py-2.5 rounded-[6px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleCalcAppend('-')}
                    className="py-2.5 rounded-[6px] bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                  >
                    -
                  </button>

                  {/* Row 4 */}
                  {['1', '2', '3'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleCalcAppend(digit)}
                      className="py-2.5 rounded-[6px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleCalcAppend('+')}
                    className="py-2.5 rounded-[6px] bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 active:scale-95 transition-all font-bold text-base"
                  >
                    +
                  </button>

                  {/* Row 5 */}
                  <button
                    type="button"
                    onClick={() => handleCalcAppend('0')}
                    className="py-2.5 rounded-[6px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCalcAppend('.')}
                    className="py-2.5 rounded-[6px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-2xs font-bold"
                  >
                    .
                  </button>
                  <button
                    type="button"
                    onClick={handleCalcEquals}
                    className="py-2.5 rounded-[6px] bg-slate-200/90 dark:bg-slate-700/90 text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all font-bold text-base"
                  >
                    =
                  </button>
                  <button
                    type="button"
                    onClick={handleCalcApply}
                    className="py-2.5 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all font-bold text-xs shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Note / Description */}
            <div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note / Description (e.g. Grocery, Lunch, Salary)"
                className="modal-field w-full h-9 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Minimal Searchable Category Dropdown */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Category
                </span>
                {onCreateCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryDropdownOpen(true);
                      setCategorySearch('');
                    }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                )}
              </div>

              {/* Dropdown Selector Button */}
              <button
                type="button"
                onClick={() => {
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                  setCategorySearch('');
                }}
                className="modal-field w-full h-9 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between hover:border-emerald-500 transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedCategory ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 text-xs shadow-2xs"
                        style={{ backgroundColor: selectedCategory.color || '#10B981' }}
                      >
                        <CategoryIcon name={selectedCategory.icon || 'Tag'} className="w-2.5 h-2.5" />
                      </div>
                      <span className="truncate">{selectedCategory.name}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">Select a category...</span>
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Floating Popover */}
              {isCategoryDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsCategoryDropdownOpen(false)}
                  />
                  <div data-category-dropdown className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/90">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Search category..."
                          className="w-full bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-md pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
                        />
                        {categorySearch && (
                          <button
                            type="button"
                            onClick={() => setCategorySearch('')}
                            className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Categories Scrollable List */}
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/40">
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map((cat) => {
                          const isSelected = categoryId === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setCategoryId(cat.id);
                                setIsCategoryDropdownOpen(false);
                                setCategorySearch('');
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-800 dark:text-emerald-300'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-medium'
                                }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-4 h-4 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                                  style={{ backgroundColor: cat.color || '#10B981' }}
                                >
                                  <CategoryIcon name={cat.icon || 'Tag'} className="w-2.5 h-2.5" />
                                </div>
                                <span className="truncate">{cat.name}</span>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="py-3 px-3 text-center text-xs text-slate-400">
                          No categories found
                        </div>
                      )}
                    </div>

                    {/* Inline Quick Add Category / Create from search */}
                    {onCreateCategory && (
                      <div className="p-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/80">
                        {categorySearch.trim() && !filteredCategories.some(c => c.name.toLowerCase() === categorySearch.trim().toLowerCase()) ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const created = await onCreateCategory(categorySearch.trim(), type);
                              setCategoryId(created.id);
                              setCategorySearch('');
                              setIsCategoryDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create &quot;{categorySearch.trim()}&quot;</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="New category name..."
                              value={newCatName}
                              onChange={(e) => setNewCatName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateNewCategory();
                                }
                              }}
                              className="flex-1 bg-white dark:bg-slate-700 px-2.5 py-1 text-xs rounded-md outline-none border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400"
                            />
                            <button
                              type="button"
                              onClick={handleCreateNewCategory}
                              disabled={!newCatName.trim()}
                              className="bg-emerald-600 disabled:opacity-50 text-white px-2.5 py-1 text-xs font-bold rounded-md hover:bg-emerald-500 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Inline Meta Strip: Account • Method */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {/* Account Selector */}
              {accounts.length > 0 ? (
                <div className="relative">
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="modal-field w-full h-9 appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 pl-3 pr-7 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none truncate cursor-pointer"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : <div />}

              {/* Payment Method Selector */}
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="modal-field w-full h-9 appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 pl-3 pr-7 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none truncate cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Account">Bank</option>
                  <option value="Mobile Wallet">Card / Wallet</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Unified Smart Date & Time Selector */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 flex items-center">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="datetime-local"
                  value={`${date}T${time}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const [d, t] = val.split('T');
                      if (d) setDate(d);
                      if (t) setTime(t.slice(0, 5));
                    }
                  }}
                  className="modal-field w-full h-9 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 pl-8 pr-2.5 text-xs font-medium font-mono text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  title="Transaction Date & Time"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setDate(formatLocalDate(now));
                  setTime(getCurrentTimeInputValue());
                  triggerHaptic('light');
                }}
                title="Reset to current Date & Time"
                className="h-9 px-2.5 rounded-[6px] text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95 shrink-0"
              >
                Now
              </button>
            </div>

          </div>

          {/* 3. Fixed Bottom Action Bar: Always visible without scrolling */}
          <div
            className="modal-chrome modal-chrome-bottom px-4 py-2.5 shrink-0"
            style={{
              paddingBottom: isKeyboardOpen
                ? 'max(env(safe-area-inset-bottom, 0px), 8px)'
                : 'max(calc(env(safe-area-inset-bottom, 0px) + 10px), 12px)',
            }}
          >
            {initialData ? (
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#059669', color: '#ffffff' }}
                  className="modal-field modal-submit-btn flex-1 py-2.5 !text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] !bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-600/25"
                >
                  {loading ? (
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Update</span>
                    </>
                  )}
                </button>

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this transaction?')) {
                        onDelete(initialData.id);
                        onClose();
                      }
                    }}
                    className="modal-field py-2.5 px-4 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            ) : entryMode === 'individual' && breakdownItems.length > 0 ? (
              <button
                type="button"
                onClick={handleSaveAllIndividualProducts}
                disabled={loading || selectedItemsCount === 0}
                style={{ backgroundColor: '#059669', color: '#ffffff' }}
                className="modal-field modal-submit-btn w-full py-2.5 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] !bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-600/25 disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Save {selectedItemsCount} Products Individually ({symbol}{selectedItemsTotal.toFixed(2)})</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={loading}
                  className="modal-field flex-1 py-2.5 rounded-[6px] border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save &amp; Continue</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={type === 'income' ? { backgroundColor: '#059669', color: '#ffffff' } : undefined}
                  className={`modal-field modal-submit-btn flex-1 py-2.5 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] ${type === 'income'
                    ? '!bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-600/25'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                    }`}
                >
                  {loading ? (
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* 3-Tab Smart Receipt Scanner Modal (Camera, Gallery, Link) */}
      {showScannerBox && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            stopCamera();
            setShowScannerBox(false);
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Smart Receipt Scanner
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Engine: {scanMode === 'ai' ? '✨ Gemini AI' : '⚡ Fast (Without AI)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowScannerBox(false);
                }}
                className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3 Tabs Bar */}
            <div className="grid grid-cols-3 p-1.5 mx-4 mt-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setScannerTab('camera');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${scannerTab === 'camera'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>1. Camera</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setScannerTab('gallery');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${scannerTab === 'gallery'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>2. Gallery</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setScannerTab('link');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${scannerTab === 'link'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>3. Link</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-4 space-y-3">
              {/* Tab 1: Camera View */}
              {scannerTab === 'camera' && (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border border-slate-700 shadow-inner">
                    {/* Live Video Viewfinder: Always in DOM */}
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${cameraStream ? 'block' : 'hidden'}`}
                    />

                    {/* Viewfinder Overlay Frame when camera is active */}
                    {cameraStream && (
                      <div className="absolute inset-3 sm:inset-4 border-2 border-emerald-400/80 border-dashed rounded-lg pointer-events-none flex flex-col justify-between p-2">
                        <span className="text-[10px] bg-black/75 text-emerald-300 px-1.5 py-0.5 rounded self-start font-mono">
                          Align receipt inside frame
                        </span>
                        <div className="flex items-center justify-between text-[10px] bg-black/75 text-slate-300 px-1.5 py-0.5 rounded self-stretch font-mono">
                          <span>Live Camera Active</span>
                          <span className="text-emerald-400">● Streaming</span>
                        </div>
                      </div>
                    )}

                    {/* Placeholder / State when stream is not active */}
                    {!cameraStream && (
                      <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full">
                        {isStartingCamera ? (
                          <div className="space-y-2">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                            <h4 className="text-sm font-bold text-white">Starting Camera Viewfinder...</h4>
                            <p className="text-[11px] text-slate-400">Requesting camera access</p>
                          </div>
                        ) : isInsecureContext ? (
                          <div className="space-y-2 max-w-xs px-2">
                            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center">
                              <ShieldAlert className="w-6 h-6" />
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-amber-300">Live Camera Requires HTTPS</h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Mobile browsers (Chrome/Safari) block in-page camera streaming on HTTP. Open via HTTPS or tap below for device camera.
                            </p>
                            {httpsProxyUrl && (
                              <a
                                href={httpsProxyUrl}
                                className="mt-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                              >
                                <span>Open Secure HTTPS ({httpsProxyUrl})</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : cameraError ? (
                          <div className="space-y-2 max-w-xs px-2">
                            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center">
                              <Camera className="w-6 h-6" />
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-rose-300">Camera Access Issue</h4>
                            <p className="text-[11px] text-slate-400">{cameraError}</p>
                            <button
                              type="button"
                              onClick={() => startCamera()}
                              className="mt-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-600 active:scale-95 transition-all"
                            >
                              Retry Camera
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startCamera()}
                            className="cursor-pointer group flex flex-col items-center justify-center p-2"
                          >
                            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform mb-2">
                              <Camera className="w-8 h-8" />
                            </div>
                            <h4 className="text-sm font-bold text-white">Tap to Start Camera View</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">Activate live in-page viewfinder</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Primary Action Button */}
                  {cameraStream ? (
                    <button
                      type="button"
                      onClick={captureLivePhoto}
                      disabled={isScanningReceipt}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
                    >
                      {isScanningReceipt ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Scanning receipt...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Snap &amp; Scan Receipt</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cameraFileInputRef.current?.click()}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap Photo with Camera App</span>
                    </button>
                  )}
                </div>
              )}

              {/* Tab 2: Gallery Picker */}
              {scannerTab === 'gallery' && (
                <div className="py-2 space-y-3 text-center">
                  <div
                    onClick={() => {
                      stopCamera();
                      setShowScannerBox(false);
                      triggerGalleryPicker();
                    }}
                    className="p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 cursor-pointer transition-all group"
                  >
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Upload from Gallery
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                      Select receipt, invoice, or handwritten grocery list from your photo library.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setShowScannerBox(false);
                      triggerGalleryPicker();
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Choose from Gallery</span>
                  </button>
                </div>
              )}

              {/* Tab 3: Scan from Link */}
              {scannerTab === 'link' && (
                <div className="space-y-3 py-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Image URL / Link
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://example.com/receipt.jpg"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-16 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                      />
                      <Link2 className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                      <button
                        type="button"
                        onClick={handlePasteLinkFromClipboard}
                        className="absolute right-2 px-2 py-1 text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
                      >
                        Paste
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Paste any direct image link or receipt image URL. The image will be fetched safely via proxy and scanned automatically.
                  </p>

                  <button
                    type="button"
                    onClick={async () => {
                      stopCamera();
                      setShowScannerBox(false);
                      await handleScanFromLink(imageUrlInput);
                    }}
                    disabled={!imageUrlInput.trim() || isLoadingImageFromLink || isScanningReceipt}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    {isLoadingImageFromLink || isScanningReceipt ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Fetching &amp; Scanning Link...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Download &amp; Scan Link</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Mode Toggle Footer inside modal */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-medium">Engine Mode:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      if (scanMode === 'ai') {
                        setReceiptScanMode('offline');
                        setScanMode('offline');
                      } else {
                        if (!hasGeminiApiKey()) {
                          setTempApiKey(getGeminiApiKey());
                          setShowApiKeyModal(true);
                        } else {
                          setReceiptScanMode('ai');
                          setScanMode('ai');
                        }
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all ${scanMode === 'ai'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{scanMode === 'ai' ? 'Gemini AI (Active)' : 'Without AI (Fast)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gemini AI API Key Setup Modal */}
      {showApiKeyModal && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowApiKeyModal(false);
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Smart Receipt Scanner</h3>
                  <p className="text-[11px] text-slate-400">Powered by Google Gemini AI</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Google Gemini automatically detects the total amount, merchant, date, and category from receipt photos. Paste your free Google AI Studio key below:
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Gemini API Key
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-3 py-2 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
              >
                <span>Get Free Key (Google AI Studio)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {onNavigateToAiSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setShowApiKeyModal(false);
                    onClose();
                    onNavigateToAiSettings();
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] underline"
                >
                  Full AI Settings
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReceiptScanMode('offline');
                  setScanMode('offline');
                  setShowApiKeyModal(false);
                  setError('');
                  triggerHaptic('light');
                  setTimeout(() => {
                    if (pendingScanTargetRef.current === 'gallery') {
                      galleryFileInputRef.current?.click();
                    } else {
                      cameraFileInputRef.current?.click();
                    }
                  }, 150);
                }}
                className="w-full sm:flex-1 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                Scan Without AI
              </button>
              <button
                type="button"
                onClick={handleSaveApiKeyAndScan}
                disabled={!tempApiKey.trim()}
                className="w-full sm:flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors shadow-sm"
              >
                Save &amp; Scan with AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
