# 图片单词提取与磨耳朵语音稿工具

这是一个本地网页小工具，用来把图片里的英语单词或日语词条提取出来，整理成可筛选、可编辑的词条集合，并生成适合“磨耳朵”的朗读稿。默认朗读节奏是“三遍词条 + 一遍中文”，也可以自己调整重复次数、中文次数、停顿时间和倍速。

## 核心功能

- 上传含英语或日语词条的图片，优先尝试浏览器自带文字识别能力；不支持时自动尝试 Tesseract.js。
- 如果当前浏览器不支持图片文字识别，可以把系统 OCR 得到的文字粘贴进来导入。
- 支持英语、日语和自动识别三种语言模式。
- 支持强力 OCR 图片增强：放大、灰度、对比增强、二值化后再识别。
- 支持把 OCR 乱文本交给 DeepSeek 整理，自动去噪、补中文释义、英语音标和日语假名读音。
- 词条列表支持勾选、全选、反选、删除、手动新增和直接编辑。
- 支持按首字母或前缀筛选，例如输入 `a`、`pre`。
- 支持把当前筛选或选中的词条保存为集合，刷新页面后仍可恢复。
- 自动生成朗读队列和语音稿预览。
- 使用浏览器 `SpeechSynthesis` 朗读，支持播放、暂停、停止、时间轴跳转和倍速调整。

## 使用方法

1. 用本地服务器打开项目目录。

   ```powershell
   node server.js
   ```

2. 浏览器访问：

   ```text
   http://localhost:5173
   ```

3. 上传词表图片，点击“识别图片文字”。

4. 如果浏览器本地 OCR 效果不好，可以先用系统截图工具、微信/QQ 或手机 OCR 识别文字，再粘贴到文本框。

5. 选择语言模式：英语、日语或自动识别。日语图片建议直接选“日语”。

6. 图片比较糊、小字多或识别乱码时，图片增强保持“强力增强”。

7. 文本比较整齐时点击“普通导入”；文本比较乱或需要补释义、音标/假名时，点击“DeepSeek 整理导入”。

8. 在词条列表里确认、编辑、筛选和勾选需要的内容。

9. 点击播放器的播放按钮开始朗读。

也可以点击“载入示例”体验筛选、语音稿和播放器功能。

## 技术架构

本工具采用纯静态前端实现，不依赖打包工具。

```text
index.html   页面结构
styles.css   界面样式
app.js       浏览器识别、文本导入、DeepSeek 整理、词条状态、集合保存、朗读播放器
server.js    静态服务和可选 DeepSeek 代理，方便手机同 Wi-Fi 访问
README.md    项目说明
```

数据流程：

```text
上传图片
-> 浏览器 TextDetector 尝试识别文字
-> 不支持时增强图片并尝试 Tesseract.js
-> 按语言模式普通解析或 DeepSeek 智能整理
-> 清洗、去重、合并已有词条
-> 用户筛选、勾选和编辑
-> 生成朗读队列
-> 浏览器 SpeechSynthesis 播放
```

## 本地识别设计

当前版本图片识别优先使用浏览器提供的实验性 `TextDetector`。这个能力不是所有浏览器都支持，所以页面会自动尝试 Tesseract.js。Tesseract.js 在浏览器里运行，不需要额外 OCR API，但手机上第一次加载和识别会慢一些。

推荐试用方式：

- 先用最新版 Chrome 或 Edge 打开页面。
- 上传清晰截图或词表图片后点击“识别图片文字”。
- 如果 Tesseract 识别效果仍然不好，就使用系统自带 OCR 或聊天软件截图 OCR，把识别文本粘贴进页面导入。

识别后会做基础清洗：

- 去掉明显不是词条的内容。
- 按词条归一化后去重。
- 与已有词条合并。
- 浏览器图片识别导入的内容会用置信度提示，方便人工检查。

## DeepSeek 整理设计

DeepSeek 不直接负责图片识别，而是负责整理 OCR 后的文本。它会把音标、假名读音、释义和词条分开放，避免把 `/əˈtʃiːv/` 这类音标拆成单词。页面会调用官方 OpenAI 兼容接口：

```text
POST https://api.deepseek.com/chat/completions
```

默认模型：

```text
deepseek-v4-flash
```

请求会使用 JSON Output：

```json
{
  "response_format": {
    "type": "json_object"
  }
}
```

页面要求模型返回：

```json
{
  "words": [
    {
      "term": "example",
      "reading": "/ɪɡˈzɑːmpəl/",
      "meaning": "例子",
      "language": "en",
      "confidence": 0.95
    },
    {
      "term": "食べる",
      "reading": "たべる",
      "meaning": "吃",
      "language": "ja",
      "confidence": 0.95
    }
  ]
}
```

注意：当前版本为了方便个人试用，会把 DeepSeek API Key 存在浏览器 `localStorage`。这不适合公开部署，但本机自用问题不大。

如果手机浏览器直连 DeepSeek 遇到跨域问题，可以把页面里的“接口地址”改成：

```text
/api/deepseek
```

然后用 `node server.js` 启动项目。这个本地服务会把请求代理到 DeepSeek，手机和电脑在同一个 Wi-Fi 下访问电脑 IP 即可。

## 手机端使用

电脑启动：

```powershell
node server.js
```

查看电脑局域网 IP：

```powershell
ipconfig
```

手机和电脑连同一个 Wi-Fi 后，在手机浏览器打开：

```text
http://电脑IP:5173
```

如果要发给不在同一个 Wi-Fi 的朋友玩，可以把 `index.html`、`styles.css`、`app.js` 放到静态网页托管上。若 DeepSeek 直连失败，再把 `server.js` 部署成一个小代理，并把页面里的“接口地址”改成代理地址。

## 数据结构

核心数据结构对应前端状态：

```ts
type WordItem = {
  id: string;
  word: string;      // 英语单词或日语词条
  phonetic?: string; // 英语音标或日语假名读音
  meaning: string;
  language?: "en" | "ja";
  selected: boolean;
  source: "ocr" | "browser" | "deepseek" | "dictionary" | "manual";
  confidence?: number;
};

type WordSet = {
  id: string;
  name: string;
  words: WordItem[];
  createdAt: string;
  updatedAt: string;
};

type ReadAloudConfig = {
  englishRepeatCount: number;
  chineseRepeatCount: number;
  includePhonetic: boolean;
  speed: number;
  pauseBetweenItemsMs: number;
};
```

当前版本通过 `server.js` 代理 DeepSeek 请求，API Key 从服务端环境变量 `DEEPSEEK_API_KEY` 读取。这样发给朋友使用时，浏览器里不会直接暴露 key。

## 公网部署

如果朋友和你不在同一个局域网，需要把项目部署到公网 Node 平台。推荐用 Render、Railway、Fly.io 这类能运行 Node 服务的平台。

### Render 部署

1. 把项目上传到一个 GitHub 仓库。

2. 打开 Render，新建 Web Service，连接这个仓库。

3. 配置：

   ```text
   Runtime: Node
   Build Command: 留空或 npm install
   Start Command: npm start
   ```

4. 添加环境变量：

   ```text
   DEEPSEEK_API_KEY=你的 DeepSeek API Key
   ```

5. 部署完成后，把 Render 给你的公网地址发给朋友。

页面里的“接口地址”保持默认：

```text
/api/deepseek
```

### 本地运行

如果只在自己电脑上测试，可以创建 `.env` 文件：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
PORT=5173
```

然后运行：

```powershell
npm start
```

如果没有 `.env` 加载工具，也可以在 PowerShell 里临时设置：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
npm start
```

## 朗读规则

默认规则：

```text
example
example
example
例子

食べる
食べる
食べる
吃
```

可调整项：

- 英文朗读次数，默认 3。
- 中文朗读次数，默认 1。
- 是否朗读读音，默认关闭。
- 词条之间停顿时间。
- 播放倍速。
- 英文、中文、日语语音角色。

时间轴使用估算时长来模拟视频式进度，因此它适合跳转和定位，但不等同于真实音频文件的精确波形时间。

## 测试清单

- 上传清晰词表图片后，支持 `TextDetector` 的浏览器可以识别出主要词条。
- 当前浏览器不支持 `TextDetector` 时，可以自动尝试 Tesseract.js。
- 粘贴 OCR 文本后，可以解析并导入英语或日语词条。
- DeepSeek 可以把乱文本整理成包含词条、读音、中文释义、语言的结构化词表。
- 英语音标不能被当成独立单词导入。
- 日语假名读音不能被当成独立词条导入。
- 可以手动新增、删除、修改词条、读音和中文释义。
- 按首字母或前缀筛选后，全选、反选、保存集合仍然正确。
- 默认“三遍英文 + 一遍中文”的朗读顺序正确。
- 修改英文遍数、中文遍数、停顿时间后，语音稿预览同步更新。
- 播放器支持播放、暂停、停止、拖动时间轴跳转和倍速播放。
- 刷新页面后，词条集合和设置仍可恢复。

## 后续扩展

- 接入独立词典接口补充更稳定的音标和中文释义。
- 可选接入 Tesseract.js 或 PaddleOCR，提升本地 OCR 稳定性。
- 支持批量上传多张图片。
- 支持导出 `.txt` 语音稿。
- 支持云端 TTS 生成 `.mp3` 文件。
- 增加按词性、长度、难度筛选。
- 增加错词本和历史练习记录。
