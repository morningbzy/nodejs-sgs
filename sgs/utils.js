
module.exports = {
    // Shuffle an Array
    shuffle(arr) {
        let _arr = [].concat(Array.from(arr));
        for(let j, x, l = _arr.length; l; j = parseInt(Math.random() * l), x = _arr[--l], _arr[l] = _arr[j], _arr[j] = x);
        return _arr;
    }
};