exports.up = function (r, connection) {
    return r.db("send2pocket").tableCreate("articles").do(() =>
        r.db("send2pocket").tableCreate("users")
    ).run(connection);
};

exports.down = function (r, connection) {
  
};
