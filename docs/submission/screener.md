# 预览链接 · Screening links

仓库目前是私有的，README 里指向 GitHub Release 的下载链接**对外打不开**（它会要求登录，对评审等于 404）。这是投递前唯一会让前面全部工作作废的技术障碍。下面三条路，选一条。

## 方案 A：FilmFreeway / Festhome 自带上传（最省事）

ZEBRA、Runway 以外的多数影展走 FilmFreeway 或 Festhome，报名表里直接上传文件或有评审专用的防盗链。**能用系统上传就用系统上传**，不要另外给链接——评审流程里多一次跳转，就多一次丢失。

上传前先压一版低码率评审用副本（~548 MB 的母版对多数系统偏大）：

```bash
ffmpeg -i out/submission/full_en.mp4 -c:v libx264 -crf 23 -preset slow \
       -c:a aac -b:a 192k -movflags +faststart \
       out/submission/full_en_screener.mp4
```

## 方案 B：Vimeo 密码链接（适合需要私密分发的场合）

Vimeo 的密码保护不在免费档，需要付费方案。上传后：
1. 隐私设为 **Password**，密码写在投稿信里（不要和链接拼成一句让爬虫抓走）。
2. 关闭下载、关闭评论。
3. 标题写 `Dawn Across the Twilight of the Stars (screener) — 5:31`。

## 方案 C：GitHub Release 转公开（如果决定提前开源）

YouTube 的"不公开列出"没有密码功能，任何人拿到链接就能看且能被转发；GitHub Release 同理，**私有仓库下对外不可见，公开仓库下永久可访问且可被搜索引擎索引**。所以：
- 只在决定"现在就开源"时用它；
- 开源前先把仓库里的 `public/vo/` 与 `public/music/` 产物确认无版权问题（旁白为 edge-tts 合成、配乐为自合成，OK）；
- 要在投稿信里单独注明"成片已公开"，让影展自行判断是否符合首映条款。

## 投稿信里怎么写

> Screener: [link], password: [password]
> Requested cut: English-subtitled, score only (5:31). A clean master without burned-in
> subtitles and sidecar SRT/VTT files are available on request.

**不要**在信里附 548 MB 的 mp4 附件。
