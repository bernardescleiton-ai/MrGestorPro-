import React, { useState, useEffect } from 'react';
import type { WhatsAppMediaAttachment } from '../types';
import { getMediaFromIDB } from '../lib/indexedDBMedia';

interface MediaPreviewProps {
  media?: WhatsAppMediaAttachment | null;
  className?: string;
  alt?: string;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ media, className = '', alt }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!media) {
      setResolvedUrl(null);
      setLoading(false);
      return;
    }

    let isCurrent = true;
    let createdObjectUrl: string | null = null;

    const resolveMediaUrl = async () => {
      // 1. If it is already a base64 Data URL or standard https URL, use immediately
      if (media.url && (media.url.startsWith('data:') || media.url.startsWith('http://') || media.url.startsWith('https://'))) {
        if (isCurrent) {
          setResolvedUrl(media.url);
          setLoading(false);
          return;
        }
      }

      setLoading(true);

      // 2. Try loading directly from IndexedDB (local storage - most reliable across reloads)
      if (media.id) {
        try {
          const blob = await getMediaFromIDB(media.id);
          if (blob && isCurrent) {
            createdObjectUrl = URL.createObjectURL(blob);
            setResolvedUrl(createdObjectUrl);
            setLoading(false);
            return;
          }
        } catch {
          // continue fallback
        }
      }

      // 3. If it's a blob: URL, check if still valid
      if (media.url && media.url.startsWith('blob:') && isCurrent) {
        try {
          const res = await fetch(media.url);
          if (res.ok && isCurrent) {
            setResolvedUrl(media.url);
            setLoading(false);
            return;
          }
        } catch {
          // Dead blob URL
        }
      }

      if (isCurrent) {
        setResolvedUrl(null);
        setLoading(false);
      }
    };

    void resolveMediaUrl();

    return () => {
      isCurrent = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [media?.id, media?.url]);

  if (!media) return null;

  if (loading) {
    return (
      <div className={`bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-xs ${className}`}>
        <span className="text-[10px]">Carregando...</span>
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className={`bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 p-1 text-center ${className}`}>
        <span className="text-base">{media.type === 'image' ? '🖼️' : '🎥'}</span>
        <span className="text-[9px] truncate max-w-full font-mono">{media.name}</span>
      </div>
    );
  }

  if (media.type === 'image') {
    return (
      <img
        src={resolvedUrl}
        alt={alt || media.name}
        className={className}
        onError={() => setResolvedUrl(null)}
      />
    );
  }

  return (
    <video
      src={resolvedUrl}
      className={className}
      muted
      playsInline
      controls={false}
    />
  );
};
