/**
 * @fileoverview KanaSensei — Kana & vocabulary data
 *
 * All character data is stored as plain objects so it can be
 * tree-shaken or lazy-loaded in future if the bundle grows.
 *
 * @author Wiktor Waryszak
 * @version 5.0
 */

/**
 * @typedef {Object} KanaCard
 * @property {string} kan  - Kana character
 * @property {string} rom  - Romaji reading
 */

/**
 * @typedef {Object} VocabCard
 * @property {string} kan  - Japanese (kana) spelling
 * @property {string} rom  - Romaji reading
 * @property {string} pl   - Polish translation
 */

/** Core hiragana — 46 base characters (a→n row) @type {KanaCard[]} */
export const hiragana = [
  { kan: 'あ', rom: 'a'   }, { kan: 'い', rom: 'i'   }, { kan: 'う', rom: 'u'   }, { kan: 'え', rom: 'e'   }, { kan: 'お', rom: 'o'   },
  { kan: 'か', rom: 'ka'  }, { kan: 'き', rom: 'ki'  }, { kan: 'く', rom: 'ku'  }, { kan: 'け', rom: 'ke'  }, { kan: 'こ', rom: 'ko'  },
  { kan: 'さ', rom: 'sa'  }, { kan: 'し', rom: 'shi' }, { kan: 'す', rom: 'su'  }, { kan: 'せ', rom: 'se'  }, { kan: 'そ', rom: 'so'  },
  { kan: 'た', rom: 'ta'  }, { kan: 'ち', rom: 'chi' }, { kan: 'つ', rom: 'tsu' }, { kan: 'て', rom: 'te'  }, { kan: 'と', rom: 'to'  },
  { kan: 'な', rom: 'na'  }, { kan: 'に', rom: 'ni'  }, { kan: 'ぬ', rom: 'nu'  }, { kan: 'ね', rom: 'ne'  }, { kan: 'の', rom: 'no'  },
  { kan: 'は', rom: 'ha'  }, { kan: 'ひ', rom: 'hi'  }, { kan: 'ふ', rom: 'fu'  }, { kan: 'へ', rom: 'he'  }, { kan: 'ほ', rom: 'ho'  },
  { kan: 'ま', rom: 'ma'  }, { kan: 'み', rom: 'mi'  }, { kan: 'む', rom: 'mu'  }, { kan: 'め', rom: 'me'  }, { kan: 'も', rom: 'mo'  },
  { kan: 'や', rom: 'ya'  },                             { kan: 'ゆ', rom: 'yu'  },                             { kan: 'よ', rom: 'yo'  },
  { kan: 'ら', rom: 'ra'  }, { kan: 'り', rom: 'ri'  }, { kan: 'る', rom: 'ru'  }, { kan: 'れ', rom: 're'  }, { kan: 'ろ', rom: 'ro'  },
  { kan: 'わ', rom: 'wa'  },                                                                                      { kan: 'を', rom: 'wo'  },
  { kan: 'ん', rom: 'n'   },
];

/** Hiragana dakuten & handakuten — 25 voiced/semi-voiced characters @type {KanaCard[]} */
export const hiraganaDakuten = [
  { kan: 'が', rom: 'ga' }, { kan: 'ぎ', rom: 'gi' }, { kan: 'ぐ', rom: 'gu' }, { kan: 'げ', rom: 'ge' }, { kan: 'ご', rom: 'go' },
  { kan: 'ざ', rom: 'za' }, { kan: 'じ', rom: 'ji' }, { kan: 'ず', rom: 'zu' }, { kan: 'ぜ', rom: 'ze' }, { kan: 'ぞ', rom: 'zo' },
  { kan: 'だ', rom: 'da' }, { kan: 'ぢ', rom: 'ji' }, { kan: 'づ', rom: 'zu' }, { kan: 'で', rom: 'de' }, { kan: 'ど', rom: 'do' },
  { kan: 'ば', rom: 'ba' }, { kan: 'び', rom: 'bi' }, { kan: 'ぶ', rom: 'bu' }, { kan: 'べ', rom: 'be' }, { kan: 'ぼ', rom: 'bo' },
  { kan: 'ぱ', rom: 'pa' }, { kan: 'ぴ', rom: 'pi' }, { kan: 'ぷ', rom: 'pu' }, { kan: 'ぺ', rom: 'pe' }, { kan: 'ぽ', rom: 'po' },
];

/** Katakana — 46 base characters @type {KanaCard[]} */
export const katakana = [
  { kan: 'ア', rom: 'a'   }, { kan: 'イ', rom: 'i'   }, { kan: 'ウ', rom: 'u'   }, { kan: 'エ', rom: 'e'   }, { kan: 'オ', rom: 'o'   },
  { kan: 'カ', rom: 'ka'  }, { kan: 'キ', rom: 'ki'  }, { kan: 'ク', rom: 'ku'  }, { kan: 'ケ', rom: 'ke'  }, { kan: 'コ', rom: 'ko'  },
  { kan: 'サ', rom: 'sa'  }, { kan: 'シ', rom: 'shi' }, { kan: 'ス', rom: 'su'  }, { kan: 'セ', rom: 'se'  }, { kan: 'ソ', rom: 'so'  },
  { kan: 'タ', rom: 'ta'  }, { kan: 'チ', rom: 'chi' }, { kan: 'ツ', rom: 'tsu' }, { kan: 'テ', rom: 'te'  }, { kan: 'ト', rom: 'to'  },
  { kan: 'ナ', rom: 'na'  }, { kan: 'ニ', rom: 'ni'  }, { kan: 'ヌ', rom: 'nu'  }, { kan: 'ネ', rom: 'ne'  }, { kan: 'ノ', rom: 'no'  },
  { kan: 'ハ', rom: 'ha'  }, { kan: 'ヒ', rom: 'hi'  }, { kan: 'フ', rom: 'fu'  }, { kan: 'ヘ', rom: 'he'  }, { kan: 'ホ', rom: 'ho'  },
  { kan: 'マ', rom: 'ma'  }, { kan: 'ミ', rom: 'mi'  }, { kan: 'ム', rom: 'mu'  }, { kan: 'メ', rom: 'me'  }, { kan: 'モ', rom: 'mo'  },
  { kan: 'ヤ', rom: 'ya'  },                             { kan: 'ユ', rom: 'yu'  },                             { kan: 'ヨ', rom: 'yo'  },
  { kan: 'ラ', rom: 'ra'  }, { kan: 'リ', rom: 'ri'  }, { kan: 'ル', rom: 'ru'  }, { kan: 'レ', rom: 're'  }, { kan: 'ロ', rom: 'ro'  },
  { kan: 'ワ', rom: 'wa'  },                                                                                      { kan: 'ヲ', rom: 'wo'  },
  { kan: 'ン', rom: 'n'   },
];

/** Vocabulary — basic Japanese words @type {VocabCard[]} */
export const vocabulary = [
  { kan: 'さくら',   rom: 'sakura',   pl: 'Wiśnia (Sakura)' },
  { kan: 'ねこ',     rom: 'neko',     pl: 'Kot'             },
  { kan: 'いぬ',     rom: 'inu',      pl: 'Pies'            },
  { kan: 'みず',     rom: 'mizu',     pl: 'Woda'            },
  { kan: 'くるま',   rom: 'kuruma',   pl: 'Samochód'        },
  { kan: 'すし',     rom: 'sushi',    pl: 'Sushi'           },
  { kan: 'ありがとう', rom: 'arigatou', pl: 'Dziękuję'      },
  { kan: 'せんせい', rom: 'sensei',   pl: 'Nauczyciel'      },
  { kan: 'がっこう', rom: 'gakkou',   pl: 'Szkoła'          },
  { kan: 'にほん',   rom: 'nihon',    pl: 'Japonia'         },
];
