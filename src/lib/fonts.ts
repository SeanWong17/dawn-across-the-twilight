import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

// The render machine has no CJK system fonts, so every face is loaded explicitly
// before the first frame is captured.
const FACES: [string, string, string][] = [
  ['DawnSerif', 'fonts/NotoSerifSC.ttf', '200 900'],
  ['DawnSans', 'fonts/NotoSansSC-Regular.otf', '400'],
];

export const SERIF = "'DawnSerif', serif";
export const SANS = "'DawnSans', sans-serif";
export const MONO = "'DejaVu Sans Mono', 'Ubuntu Mono', monospace";

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading CJK fonts', { timeoutInMilliseconds: 120000 });
  Promise.all(
    FACES.map(([family, url, weight]) =>
      new FontFace(family, `url(${staticFile(url)})`, { weight }).load().then((f) => {
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
      }),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => cancelRender(err));
}
