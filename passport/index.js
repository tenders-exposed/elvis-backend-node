'use strict';

const config = require('../config/default');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const LocalStrategy = require('passport-local').Strategy;

module.exports.configureStrategies = () => {
  passport.use(new LocalStrategy(((username, password, done) => done(null, { id: 'test' }))));

  passport.use(new GitHubStrategy(
    {
      clientID: config.passport.github.clientId,
      clientSecret: config.passport.github.clientSecret,
      callbackURL: config.passport.github.callbackUrl,
    },
    (accessToken, refreshToken, profile, cb) =>
      // TODO find or create user
      cb(null, profile)
    ,
  ));

  passport.use(new TwitterStrategy(
    {
      consumerKey: config.passport.twitter.apiKey,
      consumerSecret: config.passport.twitter.apiSecret,
      callbackURL: config.passport.twitter.callbackUrl,
    },
    (token, tokenSecret, profile, cb) =>
      // TODO find or create user
      cb(null, profile)
    ,
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) =>
    // TODO findByID user
    done(null, { id }));
};
