function iterable(x) {
    return typeof x === 'object' && x[Symbol.iterator] instanceof Function;
}


module.exports = {
    toSet(x) {
        if (iterable(x)) {
            return new Set(x);
        } else {
            return new Set([x]);
        }
    },

    toArray(x) {
        if (x === undefined || x === null) {
            return [];
        } else if (Array.isArray(x)) {
            return x;
        } else if (iterable(x)) {
            return Array.from(x);
        }
        return [x];
    },

    toSingle(x) {
        if (Array.isArray(x)) {
            return x[0];
        } else if (iterable(x)) {
            return x[Symbol.iterator]().next().value;
        }
        return x;
    },

    jsonReplacer(k, v) {
        if (typeof v === 'object' && v instanceof Set) {
            return [...v];
        }
        return v;
    },

    // Shuffle an Array
    shuffle(arr) {
        let _arr = [].concat(this.toArray(arr));
        for (let j, x, l = _arr.length; l; j = parseInt(Math.random() * l), x = _arr[--l], _arr[l] = _arr[j], _arr[j] = x) ;
        return _arr;
    },
};