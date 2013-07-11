var injector = angular.injector(['ng','indx']);
window.u = injector.get('utils');
window.indx = injector.get('client');
window.s = indx.store;
