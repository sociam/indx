'use strict';

/* http://docs.angularjs.org/guide/dev_guide.e2e-testing */

describe('example', function() {

  beforeEach(function() {
    browser().navigateTo('../../../apps/examples/html/angular-example.html');
    sleep(1);
    console.log(element('.login_logout_btn').text())
    if (element('.login_logout_btn').text().value.indexOf('log in to webbox') === -1) {
      element('.login_logout_btn').click();
      element('#logout_dialog .logoutbtn').click();
      sleep(1);
    }
    //browser().navigateTo('../../../html/index.html');
  });

  it('should have indx brand', function () {
    expect(element('.lead').text()).toEqual('real time collaboration');
    /*setTimeout(function () {
      expect(element('.brand').query(function (elements, done) {
        .text().trim()).toEqual('indx');
      resume();
    }, 200);*/
    //pause();

    //debugger;
    //console.log(element('body').html())
    //expect(element('.brand').text()).toEqual('indx');
  });

  it('should allow someone to login', function () {

    element('.login_logout_btn').click();
    sleep(1);
    input('_login_username').enter('webbox');
    input('_login_password').enter('foobar');
    element('#login_dialog .btn-primary').click();
    sleep(1);
  });


  /*it('should automatically redirect to /view1 when location hash/fragment is empty', function() {
    expect(browser().location().url()).toBe("/view1");
  });


  describe('view1', function() {

    beforeEach(function() {
      browser().navigateTo('#/view1');
    });


    it('should render view1 when user navigates to /view1', function() {
      expect(element('[ng-view] p:first').text()).
        toMatch(/partial for view 1/);
    });

  });


  describe('view2', function() {

    beforeEach(function() {
      browser().navigateTo('#/view2');
    });


    it('should render view2 when user navigates to /view2', function() {
      expect(element('[ng-view] p:first').text()).
        toMatch(/partial for view 2/);
    });

  });*/
});
