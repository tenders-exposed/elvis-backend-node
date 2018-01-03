'use strict';

const _ = require('lodash');
const config = require('../config/default');

// Base node class for use in factories
class BaseNode {
  constructor(attrs = {}) {
    Object.assign(this, attrs);
    if (_.isUndefined(this.class)) {
      throw Error('Attribute "class" is necessary to know what kind of node to create.');
    }
  }
  async save() {
    const created = await config.db.create('vertex', this.class)
      .set(this).commit().one();
    return created;
  }
  async destroy() {
    const deleted = await config.db.delete('vertex', this.class)
      .where({ id: this.id }).commit().one();
    return deleted;
  }
  formatJSON() {
    return JSON.parse(JSON.stringify(_.omit(this, ['class'])));
  }
}

module.exports = BaseNode;
