"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import styles from "./VideoTutorial.module.css";

type VideoTutorialProps = {
  /** Path to your FINAL narrated MP4 inside public/videos. */
  videoSrc?: string;
  /** Optional poster image. Only supply a path when the file exists. */
  posterSrc?: string;
  /** Optional accurately timed English WebVTT captions. */
  captionsSrc?: string;
  buttonLabel?: string;
  /** Hidden by default to save space in the header. */
  durationLabel?: string;
};

/** Wrap ONLY the existing logo + name + tagline, not the navigation. */
export function TutorialHeaderRow({
  children,
  ...videoProps
}: VideoTutorialProps & { children: ReactNode }) {
  return (
    <div className={styles.headerRow}>
      <div className={styles.brandSlot}>{children}</div>
      <VideoTutorial {...videoProps} />
    </div>
  );
}

export default function VideoTutorial({
  videoSrc = "/videos/how-to-use-where-is-my-masjid.mp4",
  posterSrc,
  captionsSrc,
  buttonLabel = "How to use",
  durationLabel,
}: VideoTutorialProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreScrollRef = useRef<(() => void) | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => () => {
    restoreScrollRef.current?.();
    restoreScrollRef.current = null;
  }, []);

  // Capture the mounted media node so unmounting also stops playback.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [isOpen]);

  function lockPageScroll() {
    if (restoreScrollRef.current) return;
    const { body, documentElement: root } = document;
    const x = window.scrollX;
    const y = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      boxSizing: body.style.boxSizing,
      rootOverflow: root.style.overflow,
    };
    const scrollbar = Math.max(0, window.innerWidth - root.clientWidth);
    const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = `-${x}px`;
    body.style.width = "100%";
    body.style.boxSizing = "border-box";
    body.style.overflow = "hidden";
    if (scrollbar) body.style.paddingRight = `${padding + scrollbar}px`;
    root.style.overflow = "hidden";
    restoreScrollRef.current = () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      body.style.boxSizing = previous.boxSizing;
      root.style.overflow = previous.rootOverflow;
      const behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      root.style.scrollBehavior = behavior;
    };
  }

  function openTutorial() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal !== "function") {
      window.location.assign(videoSrc);
      return;
    }
    setHasError(false);
    setIsOpen(true);
    dialog.showModal();
    lockPageScroll();
    closeRef.current?.focus({ preventScroll: true });
  }

  function finishClosing() {
    // Ignore an old close event if the visitor already reopened the dialog.
    if (dialogRef.current?.open) return;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    restoreScrollRef.current?.();
    restoreScrollRef.current = null;
    setIsOpen(false);
    setHasError(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function closeTutorial() {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    videoRef.current?.pause();
    dialog.close();
    finishClosing();
  }

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) closeTutorial();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-controls={`${id}-dialog`}
        aria-expanded={isOpen}
        onClick={openTutorial}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M10 8.5 16 12l-6 3.5Z" fill="currentColor" />
        </svg>
        <span>{buttonLabel}</span>
        {durationLabel && <span className={styles.duration}>{durationLabel}</span>}
      </button>
      <dialog
        ref={dialogRef}
        id={`${id}-dialog`}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClick={closeOnBackdrop}
        onCancel={(event) => { event.preventDefault(); closeTutorial(); }}
        onClose={finishClosing}
      >
        <div className={styles.modalHeader}>
          <h2 id={`${id}-title`} className={styles.title}>
            How to use Where’s My Masjid
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            aria-label="Close video tutorial"
            onClick={closeTutorial}
          >
            <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p id={`${id}-description`} className={styles.description}>
          Find a nearby masjid and get directions.
        </p>
        <div className={styles.media}>
          {/* No video/source/poster is mounted before the visitor opens it. */}
          {isOpen && (
            <video
              ref={videoRef}
              className={styles.video}
              src={videoSrc}
              poster={posterSrc}
              controls
              playsInline
              preload="metadata"
              aria-label="How to use Where’s My Masjid video tutorial"
              onError={() => setHasError(true)}
            >
              {captionsSrc && (
                <track kind="captions" src={captionsSrc} srcLang="en" label="English" default />
              )}
              Your browser does not support embedded video.
            </video>
          )}
        </div>
        <div className={styles.footer}>
          {hasError ? (
            <p className={styles.error} role="alert">
              The video could not load. Try opening it separately below.
            </p>
          ) : (
            <p className={styles.hint}>Press play to watch. Close to return to the site.</p>
          )}
          <a className={styles.directLink} href={videoSrc} target="_blank" rel="noopener noreferrer">
            Open video separately
          </a>
        </div>
      </dialog>
    </>
  );
}
