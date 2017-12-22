'use strict';

const config = require('../../config/default');

class AccountController {
  static deleteAccount(req) {
    return config.db.delete().from('User')
      .where({ id: req.user.id }).one();
  }
}

module.exports = AccountController;
