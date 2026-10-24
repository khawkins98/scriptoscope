// Independent PACH130/native and declared modern literals frozen before any
// candidate runtime inspection. Generated once by external reverse-writer
// classification; no src imports, runtime constants, or observed outputs.
// Marker RGB transport is defined here, not original device/color evidence.
export const HEADER_NATIVE_LITERALS = [
  {
    "name": "overlap-tile",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "rows": [
      "ABCDECDECFG",
      "HIJKLJKLJMN",
      "OP.QR#QRRST",
      "UVW#####XYZ",
      "abc#####def",
      "OP######RST",
      "UVW#dc#dXYZ",
      "ghijkijkilm",
      "nopqrpqrpst"
    ]
  },
  {
    "name": "overlap-list",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "list-view-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "rows": [
      "ABCDECDECFG",
      "HIJKLJKLJMN",
      "OP.QR#QRRST",
      "UVW#####XYZ",
      "abc#####def",
      "OP######RST",
      "UVW#####XYZ",
      "abc#dc#ddef",
      "ghijkijkilm"
    ]
  },
  {
    "name": "overlap-clip",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -8,
      11
    ],
    "offset": [
      0,
      0
    ],
    "clip": [
      3,
      2,
      5,
      5
    ],
    "rows": [
      "...........",
      "...........",
      "...QR#QR...",
      "...#####...",
      "...#####...",
      "...#####...",
      "...#dc#d...",
      "...........",
      "..........."
    ]
  },
  {
    "name": "first-strip",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 1,
    "tile": false,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "rows": [
      "ABCCCCCCCFG",
      "HI#######MN",
      "O#########T",
      "O#########T",
      "O#########T",
      "O#########T",
      "O#########T",
      "gh#######lm",
      "nopppppppst"
    ]
  },
  {
    "name": "first-strip-sampled",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 1,
    "tile": false,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "sampled": true,
    "rows": [
      "ABcccccccFG",
      "HI#######MN",
      "o#########t",
      "o#########t",
      "o#########t",
      "o#########t",
      "o#########t",
      "gh#######lm",
      "noPPPPPPPst"
    ]
  },
  {
    "name": "one-middle-true",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 3,
    "side": 1,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "sampled": true,
    "rows": [
      "ABCdddddEFG",
      "HIJ#####LMN",
      "OP.#####RST",
      "u#########z",
      "u#########z",
      "u#########z",
      "abc#####def",
      "ghi#####klm",
      "nopQQQQQrst"
    ]
  },
  {
    "name": "tiny-overlap",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 3,
    "height": 3,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "rows": [
      "AFG",
      "glm",
      "nst"
    ]
  },
  {
    "name": "over-half",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 4,
    "side": 1,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "rows": [
      "ABCD...DEFG",
      "HIJK###KLMN",
      "OP.Q###QRST",
      "UVW.###.XYZ",
      ".#########.",
      "UVW.###.XYZ",
      "abc.###.def",
      "ghij###jklm",
      "nopq...qrst"
    ]
  },
  {
    "name": "corner-over-source",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 9,
    "side": 1,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "rows": [
      "ABCDABCDEFG",
      "HIJKHIJKLMN",
      "ABCDABCDEFG",
      "HIJKHIJKLMN",
      "OPcQOPTQRST",
      "UVWjUVWjXYZ",
      "abcqabcqdef",
      "ghijghijklm",
      "nopqnopqrst"
    ]
  },
  {
    "name": "no-insets",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 0,
    "side": 0,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "rows": [
      "###########",
      "###########",
      "###########",
      "###########",
      "###########",
      "###########",
      "###########",
      "###########",
      "###########"
    ]
  },
  {
    "name": "empty-clip",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      0,
      0
    ],
    "offset": [
      0,
      0
    ],
    "clip": [
      20,
      20,
      0,
      0
    ],
    "rows": [
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "...........",
      "..........."
    ]
  },
  {
    "name": "pattern-0",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 0,
    "rows": [
      "A..........",
      "...........",
      "...B45B7...",
      "..2301230..",
      "..6745674..",
      "..2301230..",
      "...74567...",
      "...........",
      "..........C"
    ]
  },
  {
    "name": "pattern-1",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 1,
    "rows": [
      "A..........",
      "...........",
      "...B12B0...",
      "..7456745..",
      "..3012301..",
      "..7456745..",
      "...01230...",
      "...........",
      "..........C"
    ]
  },
  {
    "name": "pattern-2",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 2,
    "rows": [
      "A..........",
      "...........",
      "...B23B1...",
      "..4567456..",
      "..0123012..",
      "..4567456..",
      "...12301...",
      "...........",
      "..........C"
    ]
  },
  {
    "name": "pattern-3",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 3,
    "rows": [
      "A..........",
      "...........",
      "...B56B4...",
      "..3012301..",
      "..7456745..",
      "..3012301..",
      "...45674...",
      "...........",
      "..........C"
    ]
  },
  {
    "name": "pattern-4",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 4,
    "rows": [
      "A..........",
      "...........",
      "...B67B5...",
      "..0123012..",
      "..4567456..",
      "..0123012..",
      "...56745...",
      "...........",
      "..........C"
    ]
  },
  {
    "name": "pattern-255",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "window-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 255,
    "rows": [
      "A..........",
      "...........",
      "...B45B7...",
      "..2301230..",
      "..6745674..",
      "..2301230..",
      "...74567...",
      "...........",
      "..........C"
    ]
  },
  {
    "name": "pattern-list-3",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "list-view-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 3,
    "clip": [
      2,
      2,
      7,
      5
    ],
    "rows": [
      "...........",
      "...........",
      "...B12B0...",
      "..7456745..",
      "..3012301..",
      "..7456745..",
      "..3012301..",
      "...........",
      "..........."
    ]
  },
  {
    "name": "pattern-list-4",
    "source": [
      "A......",
      ".......",
      "...B...",
      ".......",
      ".......",
      ".......",
      "......C"
    ],
    "width": 11,
    "height": 9,
    "kind": "list-view-header",
    "corner": 2,
    "side": 3,
    "tile": true,
    "origin": [
      -5,
      7
    ],
    "offset": [
      1,
      -2
    ],
    "patternMode": 4,
    "clip": [
      2,
      2,
      7,
      5
    ],
    "rows": [
      "...........",
      "...........",
      "...B23B1...",
      "..4567456..",
      "..0123012..",
      "..4567456..",
      "..0123012..",
      "...........",
      "..........."
    ]
  }
];

export const HEADER_STATE_DECISIONS = [[0,-9568],[1,-9567],[2,-9567],[2147483648,-9567],[4294967295,-9567]];
export const markerRgba = token => token === "." ? [0,0,0,0] : token === "#" ? [48,48,48,255] : [token.charCodeAt(0),255-token.charCodeAt(0),(token.charCodeAt(0)*3)%256,255];
export const literalPixels = rows => rows.flatMap(row => [...row].flatMap(markerRgba));

// C1–C8 compatibility literals: rectangular source partitions, RGBA copies,
// and post-slice raster center, independently frozen from the pinned contract.
export const HEADER_COLUMN_LITERALS = [
  {
    "name": "columns-False-[11]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      11
    ],
    "height": 16,
    "tile": false,
    "centerFill": false,
    "rows": [
      "ABCCCDDEEFG",
      "HIJJJKKLLMN",
      "OP...QQRRST",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "abccc..ddef",
      "ghiiijjkklm",
      "nopppqqrrst"
    ]
  },
  {
    "name": "columns-False-[11]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      11
    ],
    "height": 16,
    "tile": false,
    "centerFill": true,
    "rows": [
      "ABCCCDDEEFG",
      "HIJJJKKLLMN",
      "OP...QQRRST",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "abccc..ddef",
      "ghiiijjkklm",
      "nopppqqrrst"
    ]
  },
  {
    "name": "columns-False-[3, 8]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      3,
      8
    ],
    "height": 16,
    "tile": false,
    "centerFill": false,
    "rows": [
      "AFGABCCDEFG",
      "HMNHIJJKLMN",
      "OSTOP..QRST",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "UYZUVWW.XYZ",
      "aefabcc.def",
      "glmghiijklm",
      "nstnoppqrst"
    ]
  },
  {
    "name": "columns-False-[3, 8]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      3,
      8
    ],
    "height": 16,
    "tile": false,
    "centerFill": true,
    "rows": [
      "AFGABCCDEFG",
      "HMNHIJJKLMN",
      "OSTOP..QRST",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "aefabcc.def",
      "glmghiijklm",
      "nstnoppqrst"
    ]
  },
  {
    "name": "columns-False-[0, 11]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      0,
      11
    ],
    "height": 16,
    "tile": false,
    "centerFill": false,
    "rows": [
      "ABCCCDDEEFG",
      "HIJJJKKLLMN",
      "OP...QQRRST",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "UVWWW..XXYZ",
      "abccc..ddef",
      "ghiiijjkklm",
      "nopppqqrrst"
    ]
  },
  {
    "name": "columns-False-[0, 11]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      0,
      11
    ],
    "height": 16,
    "tile": false,
    "centerFill": true,
    "rows": [
      "ABCCCDDEEFG",
      "HIJJJKKLLMN",
      "OP...QQRRST",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "abccc..ddef",
      "ghiiijjkklm",
      "nopppqqrrst"
    ]
  },
  {
    "name": "columns-False-[]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [],
    "height": 16,
    "tile": false,
    "centerFill": false,
    "rows": [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]
  },
  {
    "name": "columns-False-[]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [],
    "height": 16,
    "tile": false,
    "centerFill": true,
    "rows": [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]
  },
  {
    "name": "columns-True-[11]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      11
    ],
    "height": 16,
    "tile": true,
    "centerFill": false,
    "rows": [
      "ABCDECDECFG",
      "HIJKLJKLJMN",
      "OP.QR.QR.ST",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "abc.dc.dcef",
      "ghijkijkilm",
      "nopqrpqrpst"
    ]
  },
  {
    "name": "columns-True-[11]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      11
    ],
    "height": 16,
    "tile": true,
    "centerFill": true,
    "rows": [
      "ABCDECDECFG",
      "HIJKLJKLJMN",
      "OP.QR.QR.ST",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "abc.dc.dcef",
      "ghijkijkilm",
      "nopqrpqrpst"
    ]
  },
  {
    "name": "columns-True-[3, 8]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      3,
      8
    ],
    "height": 16,
    "tile": true,
    "centerFill": false,
    "rows": [
      "AFGABCDECFG",
      "HMNHIJKLJMN",
      "OSTOP.QR.ST",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "UYZUVW.XWYZ",
      "aefabc.dcef",
      "glmghijkilm",
      "nstnopqrpst"
    ]
  },
  {
    "name": "columns-True-[3, 8]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      3,
      8
    ],
    "height": 16,
    "tile": true,
    "centerFill": true,
    "rows": [
      "AFGABCDECFG",
      "HMNHIJKLJMN",
      "OSTOP.QR.ST",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "UYZUVIIIIYZ",
      "aefabc.dcef",
      "glmghijkilm",
      "nstnopqrpst"
    ]
  },
  {
    "name": "columns-True-[0, 11]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      0,
      11
    ],
    "height": 16,
    "tile": true,
    "centerFill": false,
    "rows": [
      "ABCDECDECFG",
      "HIJKLJKLJMN",
      "OP.QR.QR.ST",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "UVW.XW.XWYZ",
      "abc.dc.dcef",
      "ghijkijkilm",
      "nopqrpqrpst"
    ]
  },
  {
    "name": "columns-True-[0, 11]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [
      0,
      11
    ],
    "height": 16,
    "tile": true,
    "centerFill": true,
    "rows": [
      "ABCDECDECFG",
      "HIJKLJKLJMN",
      "OP.QR.QR.ST",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "UVIIIIIIIYZ",
      "abc.dc.dcef",
      "ghijkijkilm",
      "nopqrpqrpst"
    ]
  },
  {
    "name": "columns-True-[]-False",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [],
    "height": 16,
    "tile": true,
    "centerFill": false,
    "rows": [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]
  },
  {
    "name": "columns-True-[]-True",
    "source": [
      "ABCDEFG",
      "HIJKLMN",
      "OP.QRST",
      "UVW.XYZ",
      "abc.def",
      "ghijklm",
      "nopqrst"
    ],
    "widths": [],
    "height": 16,
    "tile": true,
    "centerFill": true,
    "rows": [
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]
  }
];
export const HEADER_COLUMN_DECISIONS = {
  "defaults": {
    "labels": [
      "Name",
      "Size",
      "Kind"
    ],
    "widths": [
      140,
      56,
      90
    ],
    "width": 286,
    "height": 16,
    "fontSize": 10,
    "cellStarts": [
      0,
      140,
      196
    ],
    "labelX": 6
  },
  "tallFaceDefault": {
    "faceHeight": 29,
    "height": 20,
    "fontSize": 12
  },
  "compactHeight": {
    "requested": 8,
    "height": 16,
    "fontSize": 10
  },
  "explicitHeight": {
    "requested": 31,
    "height": 31,
    "fontSize": 19
  },
  "inactiveIds": [
    [
      false,
      -9567
    ],
    [
      true,
      -9568
    ]
  ],
  "empty": {
    "width": 0,
    "height": 16,
    "labels": []
  }
};
