'use client';

import React from 'react';
import { BODY_FONT } from '../../lib/ui.js';

/**
 * Universal War Dogs Academy Action Button.
 * Features:
 * - Fluid sizing (auto width with min-width to prevent text clipping)
 * - Direction-aware icons for internal actions and external website links
 * - Two brand variants:
 *   - 'solid': High-contrast WDA magenta fill with ambient glow, deepening on hover
 *   - 'outline': Crisp white background, 2px magenta border; fills solid with magenta on hover
 * - Works as <button> or <a> (polymorphic)
 */
export default function Button({
  children,
  onClick,
  href,
  variant = 'solid', // 'solid' | 'outline' | 'ghost'
  type = 'button',
  disabled = false,
  loading = false,
  loadingText = 'Loading…',
  showArrow = true, // Internal action arrow; outbound links always get their icon.
  className = '',
  style = {},
  title,
  ariaLabel,
  target,
  rel,
  ...props
}) {
  const blocked = disabled || loading;
  // Internal destinations are relative app paths. Absolute web destinations
  // always identify the outbound action, even when showArrow is false.
  const externalLink = typeof href === 'string' && /^(?:https?:)?\/\//i.test(href);

  const content = (
    <>
      <span className="wda-btn-text">
        {loading ? (
          <span className="wda-btn-loading-wrap">
            <span className="wda-btn-spinner" aria-hidden="true" />
            <span>{loadingText || children}</span>
          </span>
        ) : (
          children
        )}
      </span>
      {(externalLink || showArrow) && !loading ? (
        <svg
          className={`wda-btn-arrow${externalLink ? ' is-external' : ''}`}
          width="18"
          height="18"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          {externalLink ? <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7m0-7L10 14" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4" />
          </> : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />}
        </svg>
      ) : null}
    </>
  );

  const sharedClassName = `wda-btn wda-btn-${variant} ${loading ? 'is-loading' : ''} ${className}`.trim();

  return (
    <>
      <style>{`
        .wda-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-width: 8.5em;
          width: auto;
          min-height: 44px;
          padding: 10px 18px;
          border-radius: 11px;
          font-family: ${BODY_FONT};
          font-size: 13.5px;
          font-weight: 700;
          line-height: 1.4;
          letter-spacing: -0.01em;
          text-decoration: none;
          cursor: pointer;
          user-select: none;
          box-sizing: border-box;
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          -webkit-tap-highlight-color: transparent;
        }

        .wda-btn-solid {
          background: var(--wda-action-fill);
          color: #FFFFFF;
          border: 0;
          padding: 12px 20px;
          box-shadow: 0 3px 12px rgba(200, 30, 134, 0.13);
        }
        .wda-btn-solid:hover:not(:disabled):not([aria-disabled="true"]) {
          background: var(--wda-action-hover);
          transform: translateY(-1.5px);
          box-shadow: 0 6px 20px rgba(200, 20, 126, 0.22), 0 2px 6px rgba(200, 20, 126, 0.12);
        }
        .wda-btn-solid:active:not(:disabled):not([aria-disabled="true"]) {
          transform: translateY(0);
          box-shadow: 0 2px 6px rgba(200, 20, 126, 0.16);
        }

        .wda-btn-outline {
          background-color: #FFFFFF;
          color: #9B0E65;
          border: 2px solid #C81E86;
          box-shadow: 0 2px 8px rgba(200, 20, 126, 0.08);
        }
        .wda-btn-outline:hover:not(:disabled):not([aria-disabled="true"]) {
          background-color: #9B0E65;
          color: #FFFFFF;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 18px rgba(200, 20, 126, 0.32);
        }
        .wda-btn-outline:active:not(:disabled):not([aria-disabled="true"]) {
          transform: translateY(0);
          background-color: #870B58;
          border-color: #870B58;
        }

        .wda-btn-ghost {
          background-color: transparent;
          color: #55504C;
          border: 1.5px solid #E8E2DB;
        }
        .wda-btn-ghost:hover:not(:disabled):not([aria-disabled="true"]) {
          background-color: #FAF6F2;
          color: #19191B;
          border-color: #D6CEC5;
        }

        .wda-btn:is(:disabled, [aria-disabled="true"]) {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        .wda-btn-arrow {
          width: 18px !important;
          height: 18px !important;
          max-width: 18px !important;
          max-height: 18px !important;
          flex-shrink: 0;
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.35s ease;
        }
        .wda-btn:hover:not(:disabled):not([aria-disabled="true"]) .wda-btn-arrow {
          transform: translateX(5px);
        }
        .wda-btn:hover:not(:disabled):not([aria-disabled="true"]) .wda-btn-arrow.is-external {
          transform: translate(2px,-2px);
        }
        .wda-btn-text { min-width: 0; overflow-wrap: anywhere; }

        .wda-btn-loading-wrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .wda-btn-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: wdaBtnSpin 0.7s linear infinite;
        }
        @keyframes wdaBtnSpin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .wda-btn, .wda-btn-arrow {
            transition: none !important;
            transform: none !important;
          }
          .wda-btn-spinner {
            animation-duration: 1.5s;
          }
        }
      `}</style>
      {href ? (
        <a
          href={href}
          className={sharedClassName}
          style={style}
          title={title}
          aria-label={ariaLabel}
          target={target}
          rel={rel}
          {...props}
          aria-disabled={blocked || undefined}
          aria-busy={loading || undefined}
          tabIndex={blocked ? -1 : props.tabIndex}
          onClick={(event) => {
            if (blocked) {
              event.preventDefault();
              return;
            }
            onClick?.(event);
          }}
        >
          {content}
        </a>
      ) : (
        <button
          type={type}
          onClick={onClick}
          disabled={blocked}
          className={sharedClassName}
          style={style}
          title={title}
          aria-label={ariaLabel}
          {...props}
          aria-busy={loading || undefined}
        >
          {content}
        </button>
      )}
    </>
  );
}
