import React, { createContext, useContext } from 'react';

/**
 * How the burnt-in text is set, and whether the picture is drawn at all.
 *
 * `bi`    the original cut: Chinese in the primary position, English beneath it.
 * `en`    the international cut: English primary and the Chinese original small, so a
 *         jury that does not read Chinese still follows the poem.
 * `none`  the clean master: picture and score, no subtitles, for screening delivery.
 *
 * `textOnly` renders the text layer alone on transparency, at the same coordinates over
 * the same timeline. Laid over the clean master it reproduces either cut, and it is the
 * cheap way to revise wording later: the layer renders without touching a single shader.
 *
 * The text is burnt into the frames, not carried on a separate track, so the two cuts are
 * separate renders. Sidecar subtitles come from `scripts/gen_subtitles.py`.
 */
export type TextMode = 'bi' | 'en' | 'none';

export type RenderOpts = { mode: TextMode; textOnly: boolean };

const OptsCtx = createContext<RenderOpts>({ mode: 'bi', textOnly: false });

export const OptsProvider: React.FC<{ mode?: TextMode; textOnly?: boolean; children: React.ReactNode }> = ({
  mode = 'bi',
  textOnly = false,
  children,
}) => <OptsCtx.Provider value={{ mode, textOnly }}>{children}</OptsCtx.Provider>;

export const useOpts = () => useContext(OptsCtx);
export const useTextMode = () => useContext(OptsCtx).mode;
