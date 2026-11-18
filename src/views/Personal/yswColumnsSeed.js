// 首次部署的展示数据。数据库写入 ysw-columns:v1 后，以 KVS 文档为准。
const pair = (sc, tc) => ({ sc, tc })
export const yswColumnsSeed = {
  version: 1,
  title: pair('谱络格栏目', '譜絡格欄目'),
  quote: pair('一个谱络格蓝猫儿🐱正在谱络格榄茗🍵着一个谱络格栏目💻', '一個譜絡格藍貓兒🐱正在譜絡格欖茗🍵著一個譜絡格欄目💻'),
  subtitle: 'programmer programming program',
  groups: [
    { id: 'lexicon', title: pair('词典源码', '詞典源碼'), projects: [
      { id: 'backend', name: pair('豫章词后端', '豫章詞後端'), repo: 'Lexicon-of-Yuzhang', note: pair('梦开始的地方', '夢開始的地方'), url: 'https://github.com/Yau-ShuoWen/Lexicon-of-Yuzhang' },
      { id: 'web', name: pair('豫章词前端', '豫章詞前端'), repo: 'Lexicon-of-Yuzhang-Web', note: pair('你敢相信，我的后端真的空跑了一年，程序员定力这一块', '你敢相信，我的後端真的空跑了一年，程式設計師定力這一塊'), url: 'https://github.com/Yau-ShuoWen/Lexicon-of-Yuzhang-Web' },
      { id: 'android', name: pair('豫章词安卓', '豫章詞安卓'), repo: 'Lexicon-of-Yuzhang-Android', note: pair('狗熊掰玉米：安卓原生→UniApp→安卓原生新写法', '狗熊掰玉米：安卓原生→UniApp→安卓原生新寫法'), url: 'https://github.com/Yau-ShuoWen/Lexicon-of-Yuzhang-Android' }
    ] },
    { id: 'tools', title: pair('日常小工具', '日常小工具'), projects: [
      { id: 'browser', name: pair('保存浏览器开启页面插件', '儲存瀏覽器開啟頁面外掛'), repo: 'Browser-Window-Saver', note: pair('你问他电脑瓶颈主要在哪里，他说知乎页面开了九百多个，内存爆了', '你問他電腦瓶頸主要在哪裡，他說知乎頁面開了九百多個，記憶體爆了'), url: 'https://github.com/Yau-ShuoWen/Browser-Window-Saver' },
      { id: 'screenshot', name: pair('截图兼快捷键', '截圖兼快捷鍵'), repo: 'ScreenShot', note: pair('自从Windows默认更新，把截图图片画质压缩之后，我就成为技术平权派了', '自從Windows預設更新，把截圖圖片畫質壓縮之後，我就成為技術平權派了'), url: 'https://github.com/Yau-ShuoWen/ScreenShot' },
      { id: 'history', name: pair('历史记录查询器', '歷史記錄查詢器'), repo: 'History-Search', note: pair('日记的状态：思念一夜未停，史书一页未启', '日記的狀態：思念一夜未停，史書一頁未啟'), url: 'https://github.com/Yau-ShuoWen/History-Search' },
      { id: 'resume', name: pair('简历自动填入插件', '履歷自動填入外掛'), repo: 'Resume-Tool', note: pair('地狱笑话：简历不存在隐私泄露，因为最大的信息来源在你海投的时候主动散的。', '地獄笑話：履歷不存在隱私洩露，因為最大的信息來源在你海投的時候主動散的。'), url: 'https://github.com/Yau-ShuoWen/Resume-Tool' }
    ] },
    { id: 'toys', title: pair('玩具', '玩具'), projects: [
      { id: 'point24', name: pair('二十四点', '二十四點'), repo: 'Point24', note: pair('小知识：你只需要把13^4=28561种全部背下来，你就可以称霸二十四点了', '小知識：你只需要把13^4=28561種全部背下來，你就可以稱霸二十四點了'), url: 'https://github.com/Yau-ShuoWen/Point24' },
      { id: 'schulter', name: pair('舒尔特方格', '舒爾特方格'), repo: 'SchulterGrid', note: pair('我曾经设想过再写一个自动解工具，后来发现机器有内存，过目不忘', '我曾經設想過再寫一個自動解工具，後來發現機器有記憶體，過目不忘'), url: 'https://github.com/Yau-ShuoWen/SchulterGrid' },
      { id: 'chess', name: pair('国际象棋棋谱笔记本', '國際象棋棋譜筆記本'), repo: 'Chess-NoteBook', note: pair('一键红温小技巧：「不就是开软件作弊嘛」', '一鍵紅溫小技巧：「不就是開軟體作弊嘛」'), url: 'https://github.com/Yau-ShuoWen/Chess-NoteBook' }
    ] }
  ]
}
