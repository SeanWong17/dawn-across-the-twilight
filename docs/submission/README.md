# 投稿包 · Submission package

**把黎明带过群星的黄昏 · Dawn Across the Twilight of the Stars**

王硕 · Shuo Wang · shuowang1998@163.com

5:31 · 1920×1080 · 30 fps · 24 shots · 8 chapters · no footage, no samples

---

## 这里面有什么

| 文件 | 用途 |
|---|---|
| `poem.zh.md` / `poem.en.md` | 原文与英译（英译即片中字幕，作者审定）。ZEBRA 要的"诗歌文本+译文"就是这两份 |
| `statement.md` | 导演陈述，中英双语。投递时按字数上限截取 |
| `technical-note.md` | 技术说明：着色器、合成、时间轴驱动、渲染方式 |
| `ai-disclosure.md` | AI 参与说明，分"文本/AI 修订"和"影像/配乐/剪辑由 AI 完成"两层 |
| `checklist.md` | 投递清单：每个影展要什么、现在缺什么、按什么顺序投 |
| `screener.md` | 预览链接怎么给 |

## 视频文件（`out/submission/`，不进 git）

| 文件 | 说明 |
|---|---|
| `full_en.mp4` | **国际投递母版**：英文主位字幕，纯配乐 |
| `full_clean.mp4` | 清洁母版：画面+配乐，无字幕（标题与片尾署名保留），用于入围后放映/存档 |
| `dawn_across_the_twilight_music.mp4` | 原双语版（中文主位），中文场与社交媒体 |
| `text_en.mov` / `text_bi.mov` | 文字层，ProRes 4444 带 alpha。叠在清洁母版上即得对应字幕版；改字只需重渲这一层 |
| `*.srt` / `*.vtt` | 中、英、双语字幕 |

## 文字署名口径

> 文案由作者主笔，Claude、GPT、Gemini 参与多轮修订；影像、配乐、剪辑由 Claude Opus 5.5 在作者导演下完成。

所有投递材料都按这一口径写，不要写成"人与 AI 共同完成"或"完全由 AI 创作"——前者低估了你的工作，后者与事实不符，评审一查制作过程就会对不上。

## 一分钟版简介

> 一部五分钟的科学散文诗电影。原文 1174 字，一字未改地出现在银幕上。全片没有一帧素材：24 个镜头都是 GLSL 着色器逐帧算出来的，配乐由 NumPy 合成。它讲地球送给远未来的一份礼物——直到群星熄灭，那个始于浅海的黎明仍在被带过尽头。

> A five-minute science prose poem, made without a single frame of footage: twenty-four shots, each one a GLSL shader; a score synthesised note by note in NumPy. It follows the dawn of one planet past the last star.
