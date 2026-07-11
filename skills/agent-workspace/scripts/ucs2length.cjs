"use strict";

function ucs2length(value) {
  const length = value.length;
  let characters = 0;
  let position = 0;
  while (position < length) {
    characters += 1;
    const first = value.charCodeAt(position);
    position += 1;
    if (first >= 0xd800 && first <= 0xdbff && position < length) {
      const second = value.charCodeAt(position);
      if ((second & 0xfc00) === 0xdc00) {
        position += 1;
      }
    }
  }
  return characters;
}

exports.default = ucs2length;
