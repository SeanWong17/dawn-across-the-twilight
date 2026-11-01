import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { MONO, SANS, SERIF } from './fonts';
import { BAR, IMG_H } from './frame';
import { useTextMode } from './lang';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
/** Fade in over `a`, hold, fade out over `b` across [t0, t1]. */
const window = (s: number, t0: number, t1: number, a: number, b: number) =>
  ease((s - t0) / a) * ease((t1 - s) / b);

const useSec = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

// The text was written by the author; the AI partners came in afterwards, over many
// rounds of revision. The credit says that, because a jury checks it against the film.
// Each row states its value in both languages, so the two cuts rank the same way.
type Credit = { labelZh: string; labelEn: string; valueZh: string; valueEn: string; subZh: string; subEn: string };

const CREDITS: Credit[] = [
  {
    labelZh: '文案 · 导演', labelEn: 'TEXT · DIRECTION',
    valueZh: '王硕', valueEn: 'Shuo Wang',
    subZh: '修订：Claude、GPT、Gemini', subEn: 'REVISED WITH CLAUDE, GPT & GEMINI',
  },
  {
    labelZh: '影像 · 配乐 · 剪辑', labelEn: 'FILM · SCORE · EDIT',
    valueZh: 'Claude Opus 5.5', valueEn: 'Claude Opus 5.5',
    subZh: 'ANTHROPIC', subEn: 'ANTHROPIC',
  },
];

/**
 * The film's last frame, on black after the Earth has gone: the title returns, then
 * who made what. Each part resolves from blur in turn; all of it fades out together.
 */
export const EndCard: React.FC<{ t0: number; t1: number }> = ({ t0, t1 }) => {
  const mode = useTextMode();
  const s = useSec();
  const out = ease((t1 - s) / 1.4);
  if (s < t0 || out <= 0) return null;
  const en = mode === 'en';
  const k = clamp01((s - t0) / (t1 - t0));
  const reveal = (at: number, len = 1.0) => ease((s - t0 - at) / len);
  const zh = '把黎明带过群星的黄昏';
  const rule = reveal(2.4, 1.4);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: BAR, height: IMG_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: out }}>
      {en ? (
        // The international end card leads with the English title; the original sits under it.
        <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 44, color: '#F1ECE2', letterSpacing: `${0.16 + 0.04 * k}em`, textShadow: '0 0 36px rgba(255,220,180,0.18)', opacity: reveal(0, 1.0) }}>
          DAWN ACROSS THE TWILIGHT OF THE STARS
        </div>
      ) : (
        <div style={{ display: 'flex', fontFamily: SERIF, fontWeight: 400, fontSize: 52, color: '#F1ECE2', letterSpacing: `${0.3 + 0.05 * k}em`, textShadow: '0 0 36px rgba(255,220,180,0.18)' }}>
          {zh.split('').map((c, i) => {
            const a = reveal(i * 0.06, 0.9);
            return (
              <span key={i} style={{ opacity: a, filter: `blur(${(1 - a) * 8}px)`, display: 'inline-block' }}>
                {c}
              </span>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 18, fontFamily: en ? SERIF : SANS, fontSize: en ? 21 : 15, color: 'rgba(225,218,206,0.6)', letterSpacing: en ? '0.24em' : `${0.46 + 0.08 * k}em`, opacity: reveal(1.1) }}>
        {en ? zh : 'DAWN ACROSS THE TWILIGHT OF THE STARS'}
      </div>
      <div style={{ marginTop: 54, marginBottom: 50, width: 240 * rule, height: 1, background: 'linear-gradient(90deg, transparent, rgba(230,222,210,0.45), transparent)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 1fr', rowGap: 34, width: en ? 1240 : 960 }}>
        {CREDITS.map((c, i) => {
          const a = reveal(3.0 + i * 0.9, 1.1);
          const style = { opacity: a, filter: `blur(${(1 - a) * 5}px)` };
          // English leads in `en`; the Chinese line is kept as the author's own wording.
          const label = en ? c.labelEn : c.labelZh;
          const value = en ? c.valueEn : c.valueZh;
          const sub = en ? c.subEn : c.subZh;
          return (
            <React.Fragment key={label}>
              <div style={{ ...style, textAlign: 'right' }}>
                <div style={{ fontFamily: en ? SANS : SERIF, fontSize: en ? 15 : 21, color: 'rgba(225,218,206,0.62)', letterSpacing: '0.24em' }}>{label}</div>
              </div>
              <div style={{ ...style, justifySelf: 'center', width: 1, background: 'rgba(230,222,210,0.22)' }} />
              <div style={{ ...style, textAlign: 'left' }}>
                <div style={{ fontFamily: SERIF, fontSize: en ? 20 : 25, color: '#EEE9DF', letterSpacing: '0.08em' }}>{value}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(225,218,206,0.42)', letterSpacing: '0.18em', marginTop: 7 }}>{sub}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* The CJK faces are only in SERIF/SANS, so the code note is set in two fonts. */}
      <div style={{ marginTop: 64, display: 'flex', alignItems: 'baseline', gap: 18, opacity: reveal(5.0, 1.2) }}>
        <span style={{ fontFamily: SANS, fontSize: 15, color: 'rgba(200,210,225,0.5)', letterSpacing: '0.2em' }}>
          {en ? 'EVERY FRAME AND EVERY NOTE, GENERATED IN CODE' : '每一帧画面、每一个音符，皆以代码生成'}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(160,190,220,0.45)', letterSpacing: '0.06em' }}>glsl · numpy · remotion</span>
      </div>
    </div>
  );
};

/** Main title: lands with the sunrise, characters resolve from blur one by one. */
export const Title: React.FC<{ t0: number; t1: number }> = ({ t0, t1 }) => {
  const s = useSec();
  const out = ease((t1 - s) / 1.0);
  if (s < t0 - 0.1 || out <= 0) return null;
  const zh = '把黎明带过群星的黄昏';
  const k = clamp01((s - t0) / (t1 - t0));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: BAR + IMG_H * 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: out }}>
      <div style={{ display: 'flex', fontFamily: SERIF, fontWeight: 500, fontSize: 76, color: '#F3EEE4', letterSpacing: `${0.28 + 0.06 * k}em`, textShadow: '0 0 40px rgba(255,220,180,0.25)' }}>
        {zh.split('').map((c, i) => {
          const a = ease((s - t0 - i * 0.07) / 0.8);
          return (
            <span key={i} style={{ opacity: a, filter: `blur(${(1 - a) * 10}px)`, display: 'inline-block', transform: `translateY(${(1 - a) * 8}px)` }}>
              {c}
            </span>
          );
        })}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 19, color: 'rgba(230,222,210,0.7)', letterSpacing: `${0.5 + 0.1 * k}em`, opacity: ease((s - t0 - 0.9) / 1.0) }}>
        DAWN ACROSS THE TWILIGHT OF THE STARS
      </div>
    </div>
  );
};

/** Era caption in the upper-left of the picture. */
export const Era: React.FC<{ t0: number; t1: number; zh: React.ReactNode; en: React.ReactNode }> = ({ t0, t1, zh, en }) => {
  const mode = useTextMode();
  const s = useSec();
  const a = window(s, t0, t1, 0.5, 0.45);
  if (a <= 0) return null;
  const isEn = mode === 'en';
  return (
    <div style={{ position: 'absolute', left: 72, top: BAR + 50, opacity: a * 0.85, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 2, height: isEn ? 24 : 40, background: 'rgba(235,228,215,0.6)' }} />
      <div>
        {isEn ? (
          <>
            <div style={{ fontFamily: SANS, fontSize: 17, color: '#E8E3DA', letterSpacing: '0.2em' }}>{en}</div>
            <div style={{ fontFamily: SERIF, fontSize: 12, color: 'rgba(220,214,204,0.42)', letterSpacing: '0.2em', marginTop: 5 }}>{zh}</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: SERIF, fontSize: 21, color: '#E8E3DA', letterSpacing: '0.18em' }}>{zh}</div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: 'rgba(220,214,204,0.6)', letterSpacing: '0.22em', marginTop: 4 }}>{en}</div>
          </>
        )}
      </div>
    </div>
  );
};
