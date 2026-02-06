"use client";

import React, { useEffect, useState } from "react";

interface DisplayInfo {
  // User Agent
  userAgent: string;
  platform: string;
  vendor: string;
  language: string;
  languages: string[];
  cookieEnabled: boolean;
  onLine: boolean;
  hardwareConcurrency: number;
  maxTouchPoints: number;

  // Viewport
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  scrollX: number;
  scrollY: number;

  // Screen
  screenWidth: number;
  screenHeight: number;
  screenAvailWidth: number;
  screenAvailHeight: number;
  screenColorDepth: number;
  screenPixelDepth: number;
  screenOrientation: string;

  // Device Pixel Ratio
  devicePixelRatio: number;

  // Computed dimensions
  cssPixelWidth: number;
  cssPixelHeight: number;
  physicalPixelWidth: number;
  physicalPixelHeight: number;

  // Document
  documentClientWidth: number;
  documentClientHeight: number;
  documentScrollWidth: number;
  documentScrollHeight: number;

  // Body
  bodyClientWidth: number;
  bodyClientHeight: number;
  bodyScrollWidth: number;
  bodyScrollHeight: number;
  bodyOffsetWidth: number;
  bodyOffsetHeight: number;

  // Visual Viewport (if available)
  visualViewportWidth: number | null;
  visualViewportHeight: number | null;
  visualViewportScale: number | null;
  visualViewportOffsetLeft: number | null;
  visualViewportOffsetTop: number | null;

  // Media Queries
  prefersColorScheme: string;
  prefersReducedMotion: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  isRetina: boolean;
  isTouchDevice: boolean;

  // Breakpoint checks
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  is2xl: boolean;

  // Meta viewport
  metaViewportContent: string | null;

  // Connection (if available)
  connectionType: string | null;
  connectionEffectiveType: string | null;
  connectionDownlink: number | null;

  // Memory (if available)
  deviceMemory: number | null;

  // Timestamp
  timestamp: string;
}

export default function TVScreenDebugPage() {
  const [info, setInfo] = useState<DisplayInfo | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  const gatherInfo = (): DisplayInfo => {
    const nav = navigator as Navigator & {
      connection?: {
        type?: string;
        effectiveType?: string;
        downlink?: number;
      };
      deviceMemory?: number;
    };

    const vv = window.visualViewport;

    return {
      // User Agent
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      languages: [...navigator.languages],
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,

      // Viewport
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,

      // Screen
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      screenAvailWidth: window.screen.availWidth,
      screenAvailHeight: window.screen.availHeight,
      screenColorDepth: window.screen.colorDepth,
      screenPixelDepth: window.screen.pixelDepth,
      screenOrientation: window.screen.orientation?.type || "unknown",

      // Device Pixel Ratio
      devicePixelRatio: window.devicePixelRatio,

      // Computed dimensions
      cssPixelWidth: window.innerWidth,
      cssPixelHeight: window.innerHeight,
      physicalPixelWidth: Math.round(window.innerWidth * window.devicePixelRatio),
      physicalPixelHeight: Math.round(window.innerHeight * window.devicePixelRatio),

      // Document
      documentClientWidth: document.documentElement.clientWidth,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,

      // Body
      bodyClientWidth: document.body?.clientWidth || 0,
      bodyClientHeight: document.body?.clientHeight || 0,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      bodyScrollHeight: document.body?.scrollHeight || 0,
      bodyOffsetWidth: document.body?.offsetWidth || 0,
      bodyOffsetHeight: document.body?.offsetHeight || 0,

      // Visual Viewport
      visualViewportWidth: vv?.width ?? null,
      visualViewportHeight: vv?.height ?? null,
      visualViewportScale: vv?.scale ?? null,
      visualViewportOffsetLeft: vv?.offsetLeft ?? null,
      visualViewportOffsetTop: vv?.offsetTop ?? null,

      // Media Queries
      prefersColorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      isPortrait: window.matchMedia("(orientation: portrait)").matches,
      isLandscape: window.matchMedia("(orientation: landscape)").matches,
      isRetina: window.matchMedia("(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)").matches,
      isTouchDevice: window.matchMedia("(pointer: coarse)").matches,

      // Tailwind breakpoints
      isXs: window.matchMedia("(max-width: 639px)").matches,
      isSm: window.matchMedia("(min-width: 640px)").matches,
      isMd: window.matchMedia("(min-width: 768px)").matches,
      isLg: window.matchMedia("(min-width: 1024px)").matches,
      isXl: window.matchMedia("(min-width: 1280px)").matches,
      is2xl: window.matchMedia("(min-width: 1536px)").matches,

      // Meta viewport
      metaViewportContent: document.querySelector('meta[name="viewport"]')?.getAttribute("content") || null,

      // Connection
      connectionType: nav.connection?.type ?? null,
      connectionEffectiveType: nav.connection?.effectiveType ?? null,
      connectionDownlink: nav.connection?.downlink ?? null,

      // Memory
      deviceMemory: nav.deviceMemory ?? null,

      // Timestamp
      timestamp: new Date().toISOString(),
    };
  };

  useEffect(() => {
    const update = () => {
      setInfo(gatherInfo());
      setUpdateCount((c) => c + 1);
    };

    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    const interval = setInterval(update, 2000);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      clearInterval(interval);
    };
  }, []);

  if (!info) {
    return <div style={{ padding: 20, fontFamily: "monospace", fontSize: 12 }}>Loading...</div>;
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: "bold", marginBottom: 4, color: "#0af" }}>{title}</div>
      {children}
    </div>
  );

  const Row = ({ label, value }: { label: string; value: string | number | boolean | null }) => (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ color: "#888", minWidth: 200 }}>{label}:</span>
      <span style={{ color: value === null ? "#666" : "#fff" }}>
        {value === null ? "N/A" : String(value)}
      </span>
    </div>
  );

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.4,
        backgroundColor: "#111",
        color: "#fff",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 16, marginBottom: 8 }}>TV Screen Debug Info</h1>
      <div style={{ marginBottom: 16, color: "#888" }}>
        Updates: {updateCount} | Last: {info.timestamp}
      </div>

      <Section title="User Agent">
        <div style={{ wordBreak: "break-all", color: "#fff", marginBottom: 8 }}>{info.userAgent}</div>
        <Row label="Platform" value={info.platform} />
        <Row label="Vendor" value={info.vendor} />
        <Row label="Language" value={info.language} />
        <Row label="Languages" value={info.languages.join(", ")} />
        <Row label="Hardware Concurrency" value={info.hardwareConcurrency} />
        <Row label="Max Touch Points" value={info.maxTouchPoints} />
        <Row label="Device Memory (GB)" value={info.deviceMemory} />
        <Row label="Cookie Enabled" value={info.cookieEnabled} />
        <Row label="Online" value={info.onLine} />
      </Section>

      <Section title="Viewport (window)">
        <Row label="innerWidth" value={info.innerWidth} />
        <Row label="innerHeight" value={info.innerHeight} />
        <Row label="outerWidth" value={info.outerWidth} />
        <Row label="outerHeight" value={info.outerHeight} />
        <Row label="scrollX" value={info.scrollX} />
        <Row label="scrollY" value={info.scrollY} />
      </Section>

      <Section title="Screen">
        <Row label="screen.width" value={info.screenWidth} />
        <Row label="screen.height" value={info.screenHeight} />
        <Row label="screen.availWidth" value={info.screenAvailWidth} />
        <Row label="screen.availHeight" value={info.screenAvailHeight} />
        <Row label="colorDepth" value={info.screenColorDepth} />
        <Row label="pixelDepth" value={info.screenPixelDepth} />
        <Row label="orientation" value={info.screenOrientation} />
      </Section>

      <Section title="Device Pixel Ratio">
        <Row label="devicePixelRatio" value={info.devicePixelRatio} />
        <Row label="CSS Pixels (viewport)" value={`${info.cssPixelWidth} x ${info.cssPixelHeight}`} />
        <Row label="Physical Pixels (computed)" value={`${info.physicalPixelWidth} x ${info.physicalPixelHeight}`} />
        <Row label="Is Retina/HiDPI" value={info.isRetina} />
      </Section>

      <Section title="Document Element">
        <Row label="clientWidth" value={info.documentClientWidth} />
        <Row label="clientHeight" value={info.documentClientHeight} />
        <Row label="scrollWidth" value={info.documentScrollWidth} />
        <Row label="scrollHeight" value={info.documentScrollHeight} />
      </Section>

      <Section title="Body">
        <Row label="clientWidth" value={info.bodyClientWidth} />
        <Row label="clientHeight" value={info.bodyClientHeight} />
        <Row label="scrollWidth" value={info.bodyScrollWidth} />
        <Row label="scrollHeight" value={info.bodyScrollHeight} />
        <Row label="offsetWidth" value={info.bodyOffsetWidth} />
        <Row label="offsetHeight" value={info.bodyOffsetHeight} />
      </Section>

      <Section title="Visual Viewport API">
        <Row label="width" value={info.visualViewportWidth} />
        <Row label="height" value={info.visualViewportHeight} />
        <Row label="scale" value={info.visualViewportScale} />
        <Row label="offsetLeft" value={info.visualViewportOffsetLeft} />
        <Row label="offsetTop" value={info.visualViewportOffsetTop} />
      </Section>

      <Section title="Meta Viewport">
        <div style={{ wordBreak: "break-all", color: info.metaViewportContent ? "#fff" : "#666" }}>
          {info.metaViewportContent || "No meta viewport tag found"}
        </div>
      </Section>

      <Section title="Media Queries">
        <Row label="Prefers Color Scheme" value={info.prefersColorScheme} />
        <Row label="Prefers Reduced Motion" value={info.prefersReducedMotion} />
        <Row label="Orientation Portrait" value={info.isPortrait} />
        <Row label="Orientation Landscape" value={info.isLandscape} />
        <Row label="Touch Device (pointer: coarse)" value={info.isTouchDevice} />
      </Section>

      <Section title="Tailwind Breakpoints">
        <Row label="xs (max-width: 639px)" value={info.isXs} />
        <Row label="sm (min-width: 640px)" value={info.isSm} />
        <Row label="md (min-width: 768px)" value={info.isMd} />
        <Row label="lg (min-width: 1024px)" value={info.isLg} />
        <Row label="xl (min-width: 1280px)" value={info.isXl} />
        <Row label="2xl (min-width: 1536px)" value={info.is2xl} />
      </Section>

      <Section title="Connection">
        <Row label="Type" value={info.connectionType} />
        <Row label="Effective Type" value={info.connectionEffectiveType} />
        <Row label="Downlink (Mbps)" value={info.connectionDownlink} />
      </Section>
    </div>
  );
}
