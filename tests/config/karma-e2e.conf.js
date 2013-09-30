basePath = '../../';

files = [
  ANGULAR_SCENARIO,
  ANGULAR_SCENARIO_ADAPTER,
  //'apps/tests/html/js/e2e-*.js'
  'tests/test/e2e/scenarios.js'
];

autoWatch = true;

browsers = ['Chrome'];

singleRun = false;

proxies = {
  '/': 'http://localhost:8211/',
  '/apps/examples/html/': 'http://localhost:8211/apps/examples/',
  '/html': 'http://localhost:8211',
  '/apps/js': 'http://localhost:8211/js',
  '/apps/img': 'http://localhost:8211/img',
  '/apps/css': 'http://localhost:8211/css'
};

junitReporter = {
  outputFile: 'test_out/e2e.xml',
  suite: 'e2e'
};
