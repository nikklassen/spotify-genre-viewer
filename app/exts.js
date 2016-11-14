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
