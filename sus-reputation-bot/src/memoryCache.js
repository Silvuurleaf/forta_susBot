module.exports = function () {
    const cache = {};
    return {
        get: function (key) {
            return cache[key];
        },
        set: function (key, val) {
            cache[key] = val;
        }
    }
}();