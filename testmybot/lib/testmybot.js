'use strict';

const log = require('./util/log');
const readConfig = require('./readconfig');
const MsgQueue = require('./msgqueue');
const testbuilder = require('./testbuilder');
const testslashbuilder = require('./testslashbuilder');

const Promise = require('bluebird');
const async = require('async');
const _ = require('lodash');

var config = { };
var container = null;
var msgqueue = new MsgQueue();
var msgqueueSlash = new MsgQueue();

function beforeAll(configToSet) {
  return new Promise(function(beforeAllResolve, beforeAllReject) {
  
    async.series([
      
      function(readConfigDone) {
        readConfig.readAndMergeConfig(configToSet).then(function(resolvedConfig) {
          config = resolvedConfig;
          readConfigDone();
        }).catch(function(err) {
          readConfigDone(err);
        });
      },
      
      function(containerReady) {
        log.debug(JSON.stringify(config, null, 2));
        try {
	  console.log('===================== Testing ======================')
          container = require('./testmybot-' + config.containermode);
          containerReady();
        } catch (err) {
          containerReady(err);
        }
      },
      
      function(containerBeforeAllReady) {
        container.beforeAll(config, msgqueue, msgqueueSlash).then(containerBeforeAllReady).catch(containerBeforeAllReady);
      }
     ],
    function(err) {
      if (err)
        beforeAllReject(err);
      else
        beforeAllResolve(config);
    });
  });
  
}

function afterAll() {
  return container.afterAll();
}

function beforeEach() {
  msgqueue.clear();
  msgqueueSlash.clear();
  return container.beforeEach();
}

function afterEach() {
  return container.afterEach();
}

function setupTestSuite(testcaseCb, assertCb, failCb) {
  testbuilder.setupTestSuite(testcaseCb, assertCb, failCb, hears, says);
}

function setupSlashTestSuite(testcaseCb, assertCb, failCb) {
  testslashbuilder.setupSlashTestSuite(testcaseCb, assertCb, failCb, hears, says);
}

function hears() {
  return container.hears.apply(container, arguments);
}

function says(channel, timeoutMillis) {
  return new Promise(function(saysResolve, saysReject) {
    
    if (!timeoutMillis) 
      timeoutMillis = config.defaultsaytimeout;

    var timeoutRequest = async.timeout(function(callback) {
      msgqueue.registerListener(
        (msg) => {
          callback(null, msg);
        },
        channel);
    }, timeoutMillis);
      
    timeoutRequest(function(err, body) {
      if (err && err.code === 'ETIMEDOUT') {
        saysReject('nothing said in time');
      } else if (err) {
        saysReject('says error: ' + err);
      } else {
        saysResolve(body);
      }
    });
  });
}

function slashs() {
  return container.slashs.apply(container, arguments);
}

function slashresponse(channel, timeoutMillis) {
  return new Promise(function(slashresponseResolve, slashresponseReject) {

    if (!timeoutMillis)
      timeoutMillis = config.defaultsaytimeout;

    var timeoutRequest = async.timeout(function(callback) {
      msgqueueSlash.registerListener(
        (msg) => {
          callback(null, msg);
        },
        channel);
    }, timeoutMillis);

    timeoutRequest(function(err, body) {
      if (err && err.code === 'ETIMEDOUT') {
        slashresponseReject('nothing said in time');
      } else if (err) {
        slashresponseReject('says error: ' + err);
      } else {
        slashresponseResolve(body);
      }
    });
  });
}

module.exports = {
  beforeAll: beforeAll,
  afterAll: afterAll,
  beforeEach : beforeEach,
  afterEach: afterEach,
  setupTestSuite: setupTestSuite,
  hears: hears,
  says: says,
  msgqueue: msgqueue,
  slashs: slashs,
  slashresponse: slashresponse,
  msgqueueSlash: msgqueueSlash
};
