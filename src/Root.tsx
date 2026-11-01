import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Chapter1, CH1_FRAMES } from './ch1/Chapter1';
import { Chapter2, CH2_FRAMES } from './ch2/Chapter2';
import { Chapter3, CH3_FRAMES } from './ch3/Chapter3';
import { Chapter4, CH4_FRAMES } from './ch4/Chapter4';
import { Chapter5, CH5_FRAMES } from './ch5/Chapter5';
import { Chapter6, CH6_FRAMES } from './ch6/Chapter6';
import { Chapter7, CH7_FRAMES } from './ch7/Chapter7';
import { Chapter8, CH8_FRAMES } from './ch8/Chapter8';
import { Full, FULL_FRAMES } from './Full';
import { ShotTest } from './ShotTest';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Ch1-Music" component={Chapter1} durationInFrames={CH1_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch1-Narration" component={Chapter1} durationInFrames={CH1_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Ch2-Music" component={Chapter2} durationInFrames={CH2_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch2-Narration" component={Chapter2} durationInFrames={CH2_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Ch3-Music" component={Chapter3} durationInFrames={CH3_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch3-Narration" component={Chapter3} durationInFrames={CH3_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Ch4-Music" component={Chapter4} durationInFrames={CH4_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch4-Narration" component={Chapter4} durationInFrames={CH4_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Ch5-Music" component={Chapter5} durationInFrames={CH5_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch5-Narration" component={Chapter5} durationInFrames={CH5_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Ch6-Music" component={Chapter6} durationInFrames={CH6_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch6-Narration" component={Chapter6} durationInFrames={CH6_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Ch7-Music" component={Chapter7} durationInFrames={CH7_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch7-Narration" component={Chapter7} durationInFrames={CH7_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Ch8-Music" component={Chapter8} durationInFrames={CH8_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Ch8-Narration" component={Chapter8} durationInFrames={CH8_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="Full-Music" component={Full} durationInFrames={FULL_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: false }} />
    <Composition id="Full-Narration" component={Full} durationInFrames={FULL_FRAMES} fps={30} width={1920} height={1080} defaultProps={{ narration: true }} />
    <Composition id="ShotTest" component={ShotTest} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ shot: 'earth', from: 0 }} />
  </>
);
