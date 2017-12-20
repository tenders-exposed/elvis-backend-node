'use strict';

const config = require('../../config/default');

class AccountController {
  static deleteAccount(req) {
    return config.db.delete().from('Users')
      .where(`@rid = ${req.user.userId}`).one();
  }
}

module.exports = AccountController;
