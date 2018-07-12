module.exports = {
    // Shuffle an Array
    shuffle(arr) {
        let _arr = [].concat(Array.from(arr));
        for (let j, x, l = _arr.length; l; j = parseInt(Math.random() * l), x = _arr[--l], _arr[l] = _arr[j], _arr[j] = x) ;
        return _arr;
    },

    toSet(x) {
        if (x[Symbol.iterator] instanceof Function) {
            return new Set(x);
        } else {
            return new Set([x]);
        }
    },

    toArray(x) {
        if (Array.isArray(x)) {
            return x;
        } else if (typeof x === 'object' && x[Symbol.iterator] instanceof Function) {
            return Array.from(x);
        }
        return [x];
    },

    jsonReplacer(k, v) {
        if (typeof v === 'object' && v instanceof Set) {
            return [...v];
        }
        return v;
    },
};