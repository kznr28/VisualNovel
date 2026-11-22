/* global monogatari */
'use strict';

monogatari.assets('scenes', {
  library_twilight: 'library_twilight.webp',
  rooftop_night: 'rooftop_night.webp',
  library_night: 'library_night.webp',
  // 旧セーブはシーン命令の色コードを保持しているため、同じ背景に解決する。
  '#142137': 'library_twilight.webp',
  '#223c56': 'rooftop_night.webp',
  '#2d263d': 'library_night.webp'
});

monogatari.characters({
  a: {
    name: 'アオイ',
    color: '#9bd3ff'
  }
});

monogatari.script({
  Start: [
    'show scene library_twilight with fadeIn',
    '閉館間際の図書室。窓の外には、一番星が輝いていた。',
    {
      Input: {
        Text: 'あなたの名前を入力してください。',
        Validation: (input) => input.trim().length > 0,
        Save: (input) => {
          monogatari.storage({ player: { name: input.trim() } });
          return true;
        },
        Revert: () => {
          monogatari.storage({ player: { name: '' } });
        },
        Warning: '名前を入力してください。'
      }
    },
    'a {{player.name}}、まだ帰らないの？',
    'a 実は、屋上から流れ星を見たくて。',
    {
      Choice: {
        Dialog: 'アオイの誘いに、どう答える？',
        Go: {
          Text: '一緒に屋上へ行く',
          Do: 'jump Rooftop'
        },
        Stay: {
          Text: '図書室に残る',
          Do: 'jump Library'
        }
      }
    }
  ],
  Rooftop: [
    'show scene rooftop_night with fadeIn',
    '夜風が二人の頬を撫でた。',
    'a ありがとう。{{player.name}}と一緒に見られてよかった。',
    '空を横切る光が、静かに願いを運んでいく。',
    '――エンディングA：星の約束',
    'end'
  ],
  Library: [
    'show scene library_night with fadeIn',
    'a そっか。じゃあ、また明日ね。',
    'ドアが閉まり、ページをめくる音だけが残った。',
    'あなたは窓の外の空を、もう一度見上げた。',
    '――エンディングB：静かな夜',
    'end'
  ]
});
