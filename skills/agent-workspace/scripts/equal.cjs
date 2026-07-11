"use strict";

function equal(left, right) {
  if (left === right) {
    return true;
  }
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object" ||
    left.constructor !== right.constructor
  ) {
    return Number.isNaN(left) && Number.isNaN(right);
  }
  if (Array.isArray(left)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => equal(value, right[index]));
  }
  if (left.constructor === RegExp) {
    return left.source === right.source && left.flags === right.flags;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) => Object.hasOwn(right, key) && equal(left[key], right[key]),
  );
}

exports.default = equal;
