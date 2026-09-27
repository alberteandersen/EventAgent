/* Stock photographs the app falls back on until a couple has photos of
   their own (Unsplash, hotlinked). Cards always sit on a warm fallback
   colour, so a missed photo still reads as intentional. */

export const img = (id: string, w = 1100) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const IMAGES = {
  orangeri: img('1519225421980-715cb0215aed'),
  arch: img('1606800052052-a08af7148866'),
  lavender: img('1499002238440-d264edd596ec'),
  invitation: img('1607344645866-009c320b63e0'),
  olive: img('1445510861639-5651173bc5d5'),
  candles: img('1464195244916-405fa0a82545'),
  longTable: img('1530103862676-de8c9debad1d'),
  florals: img('1522673607200-164d1b6ce486'),
  barn: img('1464366400600-7168b8af9bc3'),
  ceremony: img('1465495976277-4387d4b0b4c6'),
  cake: img('1535254973040-607b474cb50d'),
  rings: img('1591604466107-ec97de577aff'),
  portrait: img('1519741497674-611481863552'),
};
