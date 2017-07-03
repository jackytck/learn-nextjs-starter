// next.config.js
module.exports = {
  exportPathMap: function () {
    return {
      "/": { page: "/" },
      "/ant": { page: "/ant" },
      "/about": { page: "/about" }
    }
  }
}
