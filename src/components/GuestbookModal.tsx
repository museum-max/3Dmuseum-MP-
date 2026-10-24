import React, { useState } from 'react';
import {
  BookOpen,
  Send,
  Sparkles,
  ShieldCheck,
  X,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { VisitorLogEntry, WalletState } from '../types';
import { addGuestbookSign } from '../firebase/service';
import { formatAddress } from '../contracts/MuseumPassContract';
import { sound } from '../audio/soundEffects';

interface GuestbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: VisitorLogEntry[];
  wallet: WalletState;
  onOpenPassModal: () => void;
}

export const GuestbookModal: React.FC<GuestbookModalProps> = ({
  isOpen,
  onClose,
  entries,
  wallet,
  onOpenPassModal,
}) => {
  if (!isOpen) return null;

  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !message.trim()) return;

    setIsSubmitting(true);
    sound.playClick();

    try {
      const entry: VisitorLogEntry = {
        id: `guest-${Date.now()}`,
        address: wallet.address,
        nickname: nickname.trim().slice(0, 60),
        message: message.trim().slice(0, 280),
        passTier: wallet.activePass?.tier || 'STANDARD',
        timestamp: new Date().toISOString(),
      };

      await addGuestbookSign(entry);
      sound.playMintFanfare();
      setMessage('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error('Guestbook sign error:', err);
      alert('Failed to sign guestbook.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Museum Visitor Ledger &amp; Guestbook
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Decentralized Visitor Register • Synced in Real-Time to Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sign Entry Form */}
          <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Sign the Visitor Log
              </h4>

              {wallet.activePass ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  {wallet.activePass.tier} PASS VERIFIED
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOpenPassModal}
                  className="text-[11px] font-mono text-amber-400 hover:underline"
                >
                  Mint Pass for Verified Badge &rarr;
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Curator Nickname / Handle"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={50}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
              />

              <div className="flex items-center px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-xs font-mono text-slate-400">
                <span className="text-[11px] truncate">Wallet: {formatAddress(wallet.address)}</span>
              </div>
            </div>

            <textarea
              placeholder="Leave a reflection or critique on the current exhibition..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={280}
              required
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500 font-mono">
                {280 - message.length} chars left
              </span>

              <button
                type="submit"
                disabled={isSubmitting || !message.trim() || !nickname.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Recording...' : 'Sign Guestbook'}</span>
              </button>
            </div>

            {success && (
              <p className="text-xs text-emerald-400 font-mono">
                ✓ Your message has been permanently preserved in the museum guestbook!
              </p>
            )}
          </form>

          {/* List of Entries */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Preserved Visitor Impressions ({entries.length})
            </h4>

            {entries.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-700/60 text-slate-400 text-xs">
                No entries yet. Be the first visitor to sign the museum ledger!
              </div>
            ) : (
              <div className="space-y-2.5">
                {entries.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.nickname}</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {formatAddress(item.address)}
                        </span>
                        {item.passTier && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {item.passTier}
                          </span>
                        )}
                      </div>

                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
