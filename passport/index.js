'use strict';

const config = require('../config/default');
const codes = require('../api/helpers/codes');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const uuidv4 = require('uuid/v4');
const GitHubStrategy = require('passport-github').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const LocalStrategy = require('passport-local').Strategy;

module.exports.localStrategyCallback = (email, password, done) => {
  config.db.select().from('User')
    .where({
      email,
    })
    .one()
    .then((user) => {
      if (!user) {
        return done(codes.BadRequest('Incorrect email.'), false);
      }
      if (user.active === false) {
        return done(codes.BadRequest('Activate your account via email before logging in'), false);
      }

      if (!bcrypt.compareSync(password, user.password)) {
        return done(codes.BadRequest('Incorrect password.'), false);
      }

      return done(null, user);
    })
    .catch((err) => done(err));
};

module.exports.githubStrategyCallback = (accessToken, refreshToken, profile, cb) => {
  let email;
  let foundUser;
  let query = 'SELECT @rid, id, email, githubId, twitterId FROM User WHERE githubId = :githubId';
  const params = {
    githubId: profile.id,
  };
  if (profile.emails && profile.emails.length) {
    profile.emails.forEach((item) => {
      if (item.primary) {
        email = item.value;
      }
    });
  }
  if (email) {
    params.email = email;
    query += ' OR email = :email';
  }
  config.db.query(
    query,
    {
      params,
    },
  )
    .then((user) => {
      if (user && user.length) {
        foundUser = user[0];
        return user[0];
      }
      return config.db.class.get('User');
    })
    .then((User) => {
      if (foundUser) {
        if (!foundUser.githubId) {
          foundUser.githubId = profile.id;
          return config.db.update(foundUser.rid).set({ githubId: profile.id }).one();
        }
        return foundUser;
      }
      params.id = uuidv4();
      return User.create(params);
    })
    .then((user) => {
      foundUser = foundUser || user;
      cb(null, foundUser);
    })
    .catch((err) => cb(err));
};

module.exports.twitterStrategyCallback = (token, tokenSecret, profile, cb) => {
  let email;
  let foundUser;
  let query = 'SELECT @rid, email, githubId, twitterId FROM User WHERE twitterId = :twitterId';
  const params = {
    twitterId: profile.id,
  };
  if (profile.emails && profile.emails.length) {
    email = profile.emails[0].value;
  }
  if (email) {
    params.email = email;
    query += ' OR email = :email';
  }
  config.db.query(
    query,
    {
      params,
    },
  )
    .then((user) => {
      if (user && user.length) {
        foundUser = user[0];
        return user[0];
      }
      return config.db.class.get('User');
    })
    .then((User) => {
      if (foundUser) {
        if (!foundUser.twitterId) {
          foundUser.twitterId = profile.id;
          return config.db.update(foundUser.rid).set({ twitterId: profile.id }).one();
        }
        return foundUser;
      }
      params.id = uuidv4();
      return User.create(params);
    })
    .then((user) => {
      foundUser = foundUser || user;
      cb(null, foundUser);
    })
    .catch((err) => cb(err));
};

module.exports.configureStrategies = () => {
  passport.use(new LocalStrategy({ usernameField: 'email' }, module.exports.localStrategyCallback));

  passport.use(new GitHubStrategy(
    {
      clientID: config.passport.github.clientId,
      clientSecret: config.passport.github.clientSecret,
      callbackURL: config.passport.github.callbackUrl,
      scope: ['user:email'],
    },
    module.exports.githubStrategyCallback,
  ));

  passport.use(new TwitterStrategy(
    {
      consumerKey: config.passport.twitter.apiKey,
      consumerSecret: config.passport.twitter.apiSecret,
      callbackURL: config.passport.twitter.callbackUrl,
      includeEmail: true,
    },
    module.exports.twitterStrategyCallback,
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    config.db.select().from('User')
      .where({ id })
      .one()
      .then((user) => done(null, user))
      .catch((err) => done(err));
  });
};
