/*global current:true, window, QUnit, document, require:true */

var phantomHelper = require('./helper.js');
var logger = require('chip')();
var glob = require('glob-expand');
require('colors');

var prefixes = logger.getPrefixes();
prefixes.log = "";
prefixes.trace = "";
logger.setPrefixes(prefixes);

module.exports = function(testOpt, done, coverage){
	'use strict';

	var suiteResults = { files: 0, success: 0, failure: 0 },
		verbose = false, cwd = process.cwd();

	return function(e, phantom){

		function handleResults(file, result, queue){
			suiteResults.success += result.success;
			suiteResults.failure += result.failure;

			coverage(file, result.__coverage__);

			if (verbose) {
				logger.log('');
			}
			if (result.failure === 0) {
				logger.info(file);
			} else {
				logger.error(file);
			}
			if (queue.length){
				loadSuite(queue.shift(), queue);
			} else {
				if (!verbose){
					logger.warn('Files: ' + (suiteResults.files) + ' Tests: ' + (suiteResults.success + suiteResults.failure) + ' Success: ' + suiteResults.success + ' Failed: ' + suiteResults.failure);
					logger.log('');
				}
				phantom.exit();
				done(suiteResults.failure? false : true);
			}
		}

		function configureQUnit(page, test){
			phantomHelper.evaluate(page, function(qunitConf) {
				QUnit.init();
				QUnit.config.blocking = false;
				QUnit.config.requireExpects = true;
				QUnit.config.autorun = false;

				for (var props in qunitConf) {
					if (qunitConf.hasOwnProperty(props)) {
						QUnit.config[props] = qunitConf[props];
					}
				}
			}, testOpt.qunit);
		}

		function initRequire(page, test){
			phantomHelper.evaluate(page, function(requireConf, paths, test) {
				if (requireConf) {
					require = requireConf;
				}
				if (require.baseUrl) {
					require.baseUrl = 'file://' + paths.cwd + '/' + require.baseUrl;
				}

				if (require.paths) {
					for (var prop in require.paths) {
						if (require.paths.hasOwnProperty(prop)) {
							require.paths[prop] = 'file://'+ paths.cwd + '/' + require.paths[prop];
						}
					}
				}

				var script = document.createElement('script');
				script.type = 'text/javascript';
				script.charset = 'utf-8';
				script.setAttribute('data-main', 'file://'+ paths.cwd + '/'+  test);
				script.src = 'file://'+ paths.lib + '/../node_modules/requirejs/require.js';

				document.head.appendChild(script);

			}, testOpt.require, {cwd: cwd, lib: __dirname},  test);
		}

		function injectDependency(page, dependencies, callback) {
			var dep = dependencies.shift();
			page.injectJs(dep, function(){
				if (dependencies.length) {
					injectDependency(page, dependencies, callback);
				} else {
					callback();
				}
			});
		}

		function executeTests(file, queue) {
			return phantom.createPage(function(e, page) {

				page.onConsoleMessage = function(text){
					if (text.indexOf('logger.')===0 && verbose){
						/* jshint evil: true */
						eval(text);
						/* jshint evil: false */
					} else {
						if (verbose){
							logger.log(text);
						}
					}
				};

				page.onError = function(e){
					logger.log(JSON.stringify(e, null, 4));
					done(false);
				};

				var testRunning = false;

				page.open(__dirname +'/../assets/empty.html', function(){
					if (testRunning) {
						return;
					}
					testRunning = true;
					var dependencies = [__dirname + '/helper.js', require.resolve('qunitjs')];

					if (testOpt.include) {
						dependencies = dependencies.concat(testOpt.include.map(function(f){ return cwd + '/' + f; }));
					}

					injectDependency(page, dependencies, function(){
						page.evaluate(function(){
							current = {
								success: 0,
								failure: 0
							};

							window.onerror = function(){
								current.failure++;
							};
							
							QUnit.testStart = function(obj){
								console.log('logger.trace("'+ obj.name.replace(/\"/g, '\\"') +'".bold)');
							};

							QUnit.log = function(testResult){
								var result = testResult.result;
								current[(result)?'success':'failure']++;

								var expected = testResult.expected,
									actual = testResult.actual,
									message = testResult.message,
									makeCliFriendly = function (input) {
										if (input.toString() === 'isNaN' && typeof input !== 'string') {
											return 'isNaN';
										} else if (typeof input === 'undefined') {
											return 'undefined';
										} else if (typeof input === 'string') {
											return input;
										} else {
											return JSON.stringify(input);
										}
									};

								if (result) {
									console.log('logger.info("'+ (message || 'test successful').replace(/([^\\])(\")/g, '$1\\"') +'")');
								} else {
									console.log('logger.error("'+ (message || 'test failed').replace(/\n/g, '\\n').replace(/([^\\])(\")/g, '$1\\"') +'")');

									if (typeof expected!== 'undefined') {
										console.log('logger.error(" expected: '+ makeCliFriendly(expected).replace(/([^\\])(\")/g, '$1\\"') +'")');
									}
									if (typeof actual!== 'undefined') {
										console.log('logger.error(" actual: '+ makeCliFriendly(actual).replace(/([^\\])(\")/g, '$1\\"') + '")');
									}
								}
							};
						}, function(){
							initRequire(page, file);
							configureQUnit(page);

							phantomHelper.waitFor(page, function(){
								return !QUnit.config.queue.length;
							}, function(){
								page.evaluate(function(){
									if (window.__coverage__){
										current.__coverage__ = window.__coverage__;
									}
									return current;
								}, function(e, result) {
									handleResults(file, result, queue);
								});
							}, function(){
								logger.error('script timeout');
								done(false);
							}, 10000);
						});
					});
				});
			});
		}

		function loadSuite(file, queue){
			if (verbose) {
				logger.log('');
				logger.warn('TESTING:' + file);
				logger.log('');
			}
			executeTests(file, queue);
		}

		function initialize(files){
			suiteResults.files = files.length;
			if (suiteResults.files === 0) {
				logger.error('no test to be run');
				done(false);
			}

			verbose = (suiteResults.files === 1 || testOpt.verbose);
			return files;
		}

		testOpt.tests = glob(testOpt.tests);
		var queue = initialize(testOpt.tests);
		loadSuite(queue.shift(), queue);
	};
};
