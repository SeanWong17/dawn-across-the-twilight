import React, { createContext, useContext } from 'react';
import { AbsoluteFill } from 'remotion';

/**
 * How a chapter meets its neighbours. Standalone chapters (the Ch*-Music comps) open
 * and close on black with their own score; inside the full film (Full.tsx) a chapter's
 * picture dissolves in over the previous one, its closing darkening is dropped where
 * the next chapter follows on directly, and the score comes from one continuous mix.
 */
export type Join = {
  /** Seconds over which this chapter's picture dissolves in over the previous one (0 = from black). */
  dissolveIn: number;
  /** The next chapter dissolves in over this one, so this one should not fade to black first. */
  joinedOut: boolean;
  /** Play the chapter's own score (false inside the full film). */
  audio: boolean;
};

const STANDALONE: Join = { dissolveIn: 0, joinedOut: false, audio: true };
const JoinCtx = createContext<Join>(STANDALONE);

export const JoinProvider: React.FC<{ join: Join; children: React.ReactNode }> = ({ join, children }) => (
  <JoinCtx.Provider value={join}>{children}</JoinCtx.Provider>
);

export const useJoin = () => useContext(JoinCtx);

/** A chapter's root: black, unless the picture is dissolving in over the previous chapter. */
export const ChapterRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { dissolveIn } = useJoin();
  return <AbsoluteFill style={{ background: dissolveIn > 0 ? 'transparent' : '#000' }}>{children}</AbsoluteFill>;
};
