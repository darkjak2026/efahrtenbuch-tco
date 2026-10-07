"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Continuous dictation for the Entwicklerbereich note field (CLAUDE-Allgemein 6.4):
// de-DE, survives speaking pauses via a silent restart, gives up after 6 failed
// restarts in a row, never appends the same words twice.
//
// Runs one non-continuous recognition session at a time and restarts it on
// "end" while recording: Android Chrome's continuous mode re-delivers earlier
// final results cumulatively, which is exactly the doubled-words bug to avoid.
//
// Data flow: the browser's speech recognition sends the audio to its vendor
// (Chrome: Google) - noted in projekt-pass.json.

const MAX_FAILED_RESTARTS = 6;

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => RecognitionLike) | null;
}

// Joins a new chunk onto existing text, dropping words the chunk repeats from
// the end of the text (some engines re-send the tail of the last phrase).
export function appendDictated(text: string, chunk: string): string {
  const add = chunk.trim();
  if (!add) return text;
  const have = text.trim().split(/\s+/).filter(Boolean);
  const words = add.split(/\s+/);
  let overlap = 0;
  for (let n = Math.min(have.length, words.length); n > 0; n--) {
    const tail = have.slice(-n).join(" ").toLowerCase();
    const head = words.slice(0, n).join(" ").toLowerCase();
    if (tail === head) {
      overlap = n;
      break;
    }
  }
  const rest = words.slice(overlap).join(" ");
  if (!rest) return text;
  return text && !/\s$/.test(text) ? `${text} ${rest}` : text + rest;
}

export function useDictation(onFinal: (chunk: string) => void, onInterim: (chunk: string) => void) {
  // Only used in components mounted after a click (never server-rendered).
  const [supported] = useState(() => recognitionCtor() !== null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const wantRef = useRef(false);
  const failsRef = useRef(0);
  const finalRef = useRef(onFinal);
  const interimRef = useRef(onInterim);
  useEffect(() => {
    finalRef.current = onFinal;
    interimRef.current = onInterim;
  });

  const startSession = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          failsRef.current = 0;
          interimRef.current("");
          finalRef.current(r[0].transcript);
        } else {
          interim += r[0].transcript;
        }
      }
      if (interim) interimRef.current(interim);
    };
    rec.onerror = (e) => {
      // Permission denied is final - no point restarting into the same wall.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") wantRef.current = false;
      else failsRef.current += 1;
    };
    rec.onend = () => {
      interimRef.current("");
      if (wantRef.current && failsRef.current < MAX_FAILED_RESTARTS) {
        try {
          rec.start();
          return;
        } catch {
          failsRef.current += 1;
        }
      }
      wantRef.current = false;
      recRef.current = null;
      setRecording(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setRecording(true);
    } catch {
      wantRef.current = false;
      setRecording(false);
    }
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (wantRef.current) {
      stop();
      return;
    }
    wantRef.current = true;
    failsRef.current = 0;
    startSession();
  }, [startSession, stop]);

  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
    },
    []
  );

  return { supported, recording, toggle, stop };
}
