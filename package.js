Package.describe({
  name: "ma:wizard",
  summary: "Forms and wizards management made easy",
  version: "2.3.0",
  git: "https://github.com/doubleslashG/ma-wizard.git"
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.1');
  
  api.use('ma:simple-schema');
  api.use('iron:router');
  api.use('natestrauser:select2');
  api.use(['ui', 'tracker', 'underscore', 'templating']);

  api.imply('ma:simple-schema');

  api.addFiles('wizard.js');
  api.addFiles('wizard-templates.html', 'client');
  api.addFiles('wizard-templates.js', 'client');

  api.export('maWizard');
});

/*
Package.onTest(function(api) {
  api.use('tinytest');
  api.use('ma:wizard');
  api.addFiles('wizard-test.js');
});
*/