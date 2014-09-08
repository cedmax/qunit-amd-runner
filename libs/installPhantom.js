var isbin = require('isbin');
var logger = require('chip')();
var prequire = require('parent-require');

module.exports = function(launchPhantom){
	'use strict';

	isbin('phantomjs', function(exists) {
		if (!exists){
			try{
				launchPhantom(prequire('phantomjs').path);
			} catch(e){
				var npm = require('npm');
				npm.load(npm.config, function (err) {
					if (err) { logger.error(err); }
					npm.commands.install(['phantomjs'], function (err) {
						if (err) { logger.error(err); }
						launchPhantom(prequire('phantomjs').path);
					});
					npm.on('log', function (message) {
						logger.info(message);
					});
				});
			}
		} else {
			launchPhantom();
		}
	});
};
