'use client';

import { useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallAppButtonProps {
  className?: string;
  variant?: 'button' | 'link' | 'tile';
}

export function InstallAppButton({ className = '', variant = 'button' }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    if (iOS) {
      // On iOS, always show the button (it will open instructions)
      setIsInstallable(true);
      return;
    }

    // For Chromium browsers, listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  // Don't render if already installed or not installable
  if (isStandalone || !isInstallable) return null;

  const buttonClasses = variant === 'tile'
    ? `flex flex-col items-center justify-center p-6 bg-theme-surface hover:bg-theme-surface-hover rounded-lg transition-colors text-white ${className}`
    : variant === 'button'
    ? `inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors ${className}`
    : `inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors ${className}`;

  return (
    <>
      <button onClick={handleClick} className={buttonClasses}>
        {variant === 'tile' ? (
          <>
            <Download size={32} className="mb-3 text-theme-primary" />
            <span className="text-lg font-medium text-center">Install App</span>
          </>
        ) : (
          <>
            <Download size={18} />
            <span>Install App</span>
          </>
        )}
      </button>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
            {/* Close button */}
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Install on iOS
              </h3>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-cyan-400 font-semibold text-sm">
                    1
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white text-sm">
                      Tap the <Share size={16} className="inline text-cyan-400 mx-1" /> Share button in Safari
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-cyan-400 font-semibold text-sm">
                    2
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white text-sm">
                      Scroll down and tap <span className="inline-flex items-center gap-1 text-cyan-400"><Plus size={14} /> Add to Home Screen</span>
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-cyan-400 font-semibold text-sm">
                    3
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white text-sm">
                      Tap <span className="text-cyan-400 font-medium">Add</span> in the top right
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700">
                <p className="text-slate-400 text-xs text-center">
                  The app will appear on your home screen for quick access
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
