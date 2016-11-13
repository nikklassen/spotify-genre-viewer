Set.prototype.intersection = function(setB) {
    var intersection = new Set();
    for (var elem of setB) {
      if (this.has(elem)) {
        intersection.add(elem);
      }
    }
    return intersection;
}

Set.prototype.equals = function(setB) {
  if (this.size !== setB.size) return false;

  for (var elem of setB) {
    if (!this.has(elem)) return false;
  }
  return true;
}

function objMap(obj, f) {
  const ret = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret[key] = f(key, obj[key], obj);
    }
  }
  return ret;
}

function objForEach(obj, f) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      f(key, obj[key], obj);
    }
  }
}

function objSome(obj, pred) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (pred(key, obj[key], obj)) {
        return true;
      }
    }
  }
  return false;
}

function objSize(obj) {
  return Object.keys(obj).length;
}

export const ObjectExts = {
  forEach: objForEach,
  some: objSome,
  map: objMap,
  size: objSize,
};
