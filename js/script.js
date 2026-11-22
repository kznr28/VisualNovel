/* global monogatari */
'use strict';

// ブラウザだけで試せる、画像素材不要のミニノベルです。
// 背景は色コードで表示しています。画像を使う場合は README を参照。
monogatari.characters({
  a: {
    name: 'アオイ',
    color: '#9bd3ff'
  }
});

monogatari.script({
  Start: [
    'show scene #142137 with fadeIn',
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
    'show scene #223c56 with fadeIn',
    '夜風が二人の頬を撫でた。',
    'a ありがとう。{{player.name}}と一緒に見られてよかった。',
    '空を横切る光が、静かに願いを運んでいく。',
    '――エンディングA：星の約束',
    'end'
  ],
  Library: [
    'show scene #2d263d with fadeIn',
    'a そっか。じゃあ、また明日ね。',
    'ドアが閉まり、ページをめくる音だけが残った。',
    'あなたは窓の外の空を、もう一度見上げた。',
    '――エンディングB：静かな夜',
    'end'
  ]
});
