QUnit AMD runner
=============

Unit tests runner based on phantomjs supporting AMD pattern. 
Offers a node API ready to be integrated in other scripts (grunt/gulp plugins, cli tools, etc)

# Docs

## Installation

`npm install qunit-amd-runner  --save-dev`

## Usage
 
```js
var testRunner = require('qunit-amd-runner');

testRunner({
	tests: ['tests/*Test.js'],
	include: [
		'test/lib/helper.js',
		'test/lib/sinon.js' // -> http://sinonjs.org/
	],
	require: {
		baseUrl: 'assets/javascripts/src',
		paths: {
			jquery: 'public/javascripts/jquery-2.0.0.min',
			mustache: 'public/javascripts/mustache',
		}
	}
}, function callback(result){
	if (!result) {
		process.exit(1);
	} else {
		//tests succeeded, do whatever you want
	}
});
```

## Arguments

### Options

#### options.include
Type: `Array`

An array of files to be injected in all the test suites.

#### options.tests
Type: `Array`

An array of patterns to retrieve the test files.
Test files are threated as require.js main files

#### options.require
Type: `Object`

RequireJS configuration
Read the [RequireJS documentation](http://www.requirejs.org/)

### Callback
Type: `function`

A callback function to be invoked at the end of the tests exection.
The result is a falsy value if tests failed.
