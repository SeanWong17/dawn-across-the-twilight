import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { JoinProvider } from './lib/join';
import { OptsProvider, TextMode } from './lib/lang';
import { Chapter1 } from './ch1/Chapter1';
import { Chapter2 } from './ch2/Chapter2';
import { Chapter3 } from './ch3/Chapter3';
import { Chapter4 } from './ch4/Chapter4';
import { Chapter5 } from './ch5/Chapter5';
import { Chapter6 } from './ch6/Chapter6';
import { Chapter7 } from './ch7/Chapter7';
import { Chapter8 } from './ch8/Chapter8';
import full from './full.json';

export const FULL_FRAMES = full.frames;

const CHAPTERS: Record<string, React.FC<{ narration: boolean }>> = {
  ch1: Chapter1, ch2: Chapter2, ch3: Chapter3, ch4: Chapter4,
  ch5: Chapter5, ch6: Chapter6, ch7: Chapter7, ch8: Chapter8,
};

export type FullProps = {
  narration?: boolean;
  /** Which language the burnt-in text speaks. */
  lang?: TextMode;
  /** Render the text layer alone on transparency, to be laid over the clean master. */
  textOnly?: boolean;
};

/**
 * The whole film as one continuous piece (layout from scripts/gen_full.py): each
 * chapter dissolves in over the end of the previous one, under one continuous score.
 *
 * `lang` picks the subtitle cut (`bi` original, `en` international, `none` clean master)
 * and `textOnly` renders just the text at the same coordinates and timeline. A clean
 * master plus an `en` text layer produces the international cut without re-running a
 * single shader, which is how a subtitle revision stays cheap.
 */
export const Full: React.FC<FullProps> = ({ narration = false, lang = 'bi', textOnly = false }) => (
  <OptsProvider mode={lang} textOnly={textOnly}>
    <AbsoluteFill style={{ background: textOnly ? 'transparent' : '#000' }}>
      {full.chapters.map((c) => {
        const Chapter = CHAPTERS[c.chapter];
        return (
          <Sequence key={c.chapter} from={c.from} durationInFrames={c.frames} name={c.chapter}>
            <JoinProvider join={{ dissolveIn: c.dissolveIn, joinedOut: c.joinedOut, audio: false }}>
              <Chapter narration={narration} />
            </JoinProvider>
          </Sequence>
        );
      })}
      {!textOnly && <Audio src={staticFile(narration ? 'music/full_narr.wav' : 'music/full_music.wav')} />}
    </AbsoluteFill>
  </OptsProvider>
);
