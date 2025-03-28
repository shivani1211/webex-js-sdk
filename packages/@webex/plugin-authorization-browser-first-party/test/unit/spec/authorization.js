/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import url from 'url';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {Credentials, Services} from '@webex/webex-core';
import {base64, patterns} from '@webex/common';
import {merge, times} from 'lodash';
import CryptoJS from 'crypto-js';
import Authorization from '@webex/plugin-authorization-browser-first-party';

// Necessary to require lodash this way in order to stub the method
const lodash = require('lodash');

describe('plugin-authorization-browser-first-party', () => {
  describe('Authorization', () => {
    function makeWebex(
      href = 'https://example.com',
      csrfToken = undefined,
      pkceVerifier = undefined,
      config = {}
    ) {
      const mockWindow = {
        history: {
          replaceState(a, b, location) {
            mockWindow.location.href = location;
          },
        },
        location: {
          href,
        },
        sessionStorage: {
          getItem: sinon.stub().onCall(0).returns(pkceVerifier).onCall(1).returns(csrfToken),
          removeItem: sinon.spy(),
          setItem: sinon.spy(),
        },
      };

      sinon.spy(mockWindow.history, 'replaceState');

      const webex = new MockWebex({
        children: {
          authorization: Authorization,
          credentials: Credentials,
          services: Services,
        },
        request: sinon
          .stub()
          .returns(
            Promise.resolve({body: {access_token: 'AT', token_type: 'Fake', refresh_token: 'RT'}})
          ),
        config: merge(
          {
            credentials: {
              idbroker: {
                url: process.env.IDBROKER_BASE_URL,
                defaultUrl: process.env.IDBROKER_BASE_URL,
              },
              identity: {
                url: process.env.IDENTITY_BASE_URL,
                defaultUrl: process.env.IDENTITY_BASE_URL,
              },
              activationUrl: `${
                process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
              }/idb/token/v1/actions/UserActivation/invoke`,
              authorizeUrl: `${
                process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
              }/idb/oauth2/v1/authorize`,
              setPasswordUrl: `${
                process.env.IDBROKER_BASE_URL || 'https://identity.webex.com'
              }/identity/scim/v1/Users`,
              logoutUrl: `${
                process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
              }/idb/oauth2/v1/logout`,
              // eslint-disable-next-line camelcase
              client_id: 'fake',
              // eslint-disable-next-line camelcase
              client_secret: 'fake',
              // eslint-disable-next-line camelcase
              redirect_uri: 'http://example.com',
              // eslint-disable-next-line camelcase
              scope: 'scope:one',
              refreshCallback: () => Promise.resolve(),
            },
          },
          config
        ),
        getWindow() {
          return mockWindow;
        },
      });

      return webex;
    }

    afterEach(() => {
      sinon.restore();
    });

    describe('#initialize()', () => {
      describe('when there is a code in the url', () => {
        it('exchanges it for an access token and sets ready', () => {
          const webex = makeWebex('http://example.com/?code=5');

          assert.isFalse(webex.authorization.ready);
          assert.isFalse(webex.credentials.canAuthorize);

          return webex.authorization.when('change:ready').then(() => {
            // Webex request gets called twice:
            // once for the pre-auth catalog
            // once for auth token exchange
            assert.calledTwice(webex.request);
            assert.isTrue(webex.authorization.ready);
            assert.isTrue(webex.credentials.canAuthorize);
          });
        });

        it('validates the csrf token', () => {
          const csrfToken = 'abcd';

          assert.throws(() => {
            // eslint-disable-next-line no-unused-vars
            const webex = makeWebex(
              `http://example.com/?code=5&state=${base64.encode(
                JSON.stringify({csrf_token: 'someothertoken'})
              )}`,
              csrfToken
            );
          }, /CSRF token someothertoken does not match stored token abcd/);

          assert.throws(() => {
            // eslint-disable-next-line no-unused-vars
            const webex = makeWebex(
              `http://example.com/?code=5&state=${base64.encode(JSON.stringify({}))}`,
              csrfToken
            );
          }, /Expected CSRF token abcd, but not found in redirect query/);

          assert.throws(() => {
            // eslint-disable-next-line no-unused-vars
            const webex = makeWebex('http://example.com/?code=5', csrfToken);
          }, /Expected CSRF token abcd, but not found in redirect query/);

          const webex = makeWebex(
            `http://example.com/?code=5&state=${base64.encode(
              JSON.stringify({csrf_token: csrfToken})
            )}`,
            csrfToken
          );

          return webex.authorization.when('change:ready').then(() => {
            assert.isTrue(webex.credentials.canAuthorize);
            assert.called(webex.getWindow().sessionStorage.removeItem);
          });
        });

        it('removes the oauth parameters from the url', () => {
          const csrfToken = 'abcd';

          const webex = makeWebex(
            `http://example.com/?code=5&state=${base64.encode(
              JSON.stringify({csrf_token: csrfToken, something: true})
            )}`,
            csrfToken
          );

          return webex.authorization.when('change:ready').then(() => {
            assert.isTrue(webex.credentials.canAuthorize);
            assert.called(webex.getWindow().sessionStorage.removeItem);
            assert.called(webex.getWindow().history.replaceState);
            assert.equal(
              webex.getWindow().location.href,
              `http://example.com/?state=${base64.encode(JSON.stringify({something: true}))}`
            );
          });
        });

        it('collects the preauth catalog when emailhash is present in the state', async () => {
          const code = 'authcode_clusterid_theOrgId';
          const webex = makeWebex(
            `http://example.com/?code=${code}&state=${base64.encode(
              JSON.stringify({emailhash: 'someemailhash'})
            )}`
          );

          const requestAuthorizationCodeGrantStub = sinon.stub(
            Authorization.prototype,
            'requestAuthorizationCodeGrant'
          );
          const collectPreauthCatalogStub = sinon
            .stub(Services.prototype, 'collectPreauthCatalog')
            .resolves();

          await webex.authorization.when('change:ready');

          assert.calledOnce(requestAuthorizationCodeGrantStub);
          assert.calledWith(requestAuthorizationCodeGrantStub, {code, codeVerifier: undefined});
          assert.calledOnce(collectPreauthCatalogStub);
          assert.calledWith(collectPreauthCatalogStub, {emailhash: 'someemailhash'});
        });

        it('collects the preauth catalog no emailhash is present in the state', async () => {
          const code = 'authcode_clusterid_theOrgId';
          const webex = makeWebex(`http://example.com/?code=${code}`);

          const requestAuthorizationCodeGrantStub = sinon.stub(
            Authorization.prototype,
            'requestAuthorizationCodeGrant'
          );
          const collectPreauthCatalogStub = sinon
            .stub(Services.prototype, 'collectPreauthCatalog')
            .resolves();

          await webex.authorization.when('change:ready');

          assert.calledOnce(requestAuthorizationCodeGrantStub);
          assert.calledWith(requestAuthorizationCodeGrantStub, {code, codeVerifier: undefined});
          assert.calledOnce(collectPreauthCatalogStub);
          assert.calledWith(collectPreauthCatalogStub, {orgId: 'theOrgId'});
        });

        it('collects the preauth catalog with no emailhash and no orgId', async () => {
          const code = 'authcode_clusterid';
          const webex = makeWebex(`http://example.com/?code=${code}`);

          const requestAuthorizationCodeGrantStub = sinon.stub(
            Authorization.prototype,
            'requestAuthorizationCodeGrant'
          );
          const collectPreauthCatalogStub = sinon
            .stub(Services.prototype, 'collectPreauthCatalog')
            .resolves();

          await webex.authorization.when('change:ready');

          assert.calledOnce(requestAuthorizationCodeGrantStub);
          assert.calledWith(requestAuthorizationCodeGrantStub, {code, codeVerifier: undefined});
          assert.calledOnce(collectPreauthCatalogStub);
          assert.calledWith(collectPreauthCatalogStub, undefined);
        });

        it('handles an error when exchanging an authorization code and becomes ready', () => {
          const code = 'errors-when-exchanging';
          const error = new Error('something bad happened');
          const requestAuthorizationCodeGrantStub = sinon
            .stub(Authorization.prototype, 'requestAuthorizationCodeGrant')
            .throws(error);

          const webex = makeWebex(`http://example.com?code=${code}`);

          return webex.authorization.when('change:ready').then(() => {
            assert.calledOnce(requestAuthorizationCodeGrantStub);
            assert.calledWith(requestAuthorizationCodeGrantStub, {code, codeVerifier: undefined});
            assert.calledOnce(webex.logger.warn);
            assert.calledWith(
              webex.logger.warn,
              'authorization: failed initial authorization code grant request',
              error
            );
          });
        });
      });
      describe('when the url contains an error', () => {
        it('throws a grant error', () => {
          let err = null;
          try {
            makeWebex(
              'http://127.0.0.1:8000/?error=invalid_scope&error_description=The%20requested%20scope%20is%20invalid.'
            );
          } catch (e) {
            err = e;
          }
          expect(err?.message).toBe('Cannot convert object to primitive value');
        });
      });

      describe('when there is nothing in the url', () => {
        it('sets ready', () => {
          const webex = makeWebex('http://example.com');

          assert.isTrue(webex.authorization.ready);
          assert.isFalse(webex.credentials.canAuthorize);
        });
      });

      describe('when code verifier is present in session storage', () => {
        it('passes codeVerifier to requestAuthorizationCodeGrant', () => {
          const expectedVerifier = 'test verifier';

          const webex = makeWebex('http://example.com?code=5', undefined, expectedVerifier);

          return webex.authorization.when('change:ready').then(() => {
            assert.calledTwice(webex.request);
            assert.calledWith(webex.getWindow().sessionStorage.getItem, 'oauth2-code-verifier');
            assert.calledWith(webex.getWindow().sessionStorage.removeItem, 'oauth2-code-verifier');
            assert.equal(webex.request.getCall(1).args[0].form.code_verifier, expectedVerifier);
          });
        });
      });
    });

    describe('#initiateLogin()', () => {
      it('calls #initiateAuthorizationCodeGrant()', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        sinon.spy(webex.authorization, 'initiateAuthorizationCodeGrant');

        return webex.authorization.initiateLogin().then(() => {
          assert.called(webex.authorization.initiateAuthorizationCodeGrant);
          assert.include(webex.getWindow().location, 'response_type=code');
        });
      });

      it('adds a csrf_token to the login url and sessionStorage', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        sinon.spy(webex.authorization, 'initiateAuthorizationCodeGrant');

        return webex.authorization.initiateLogin().then(() => {
          assert.called(webex.authorization.initiateAuthorizationCodeGrant);
          assert.include(webex.getWindow().location, 'response_type=code');
          const {query} = url.parse(webex.getWindow().location, true);
          let {state} = query;

          state = JSON.parse(base64.decode(state));
          assert.property(state, 'csrf_token');
          assert.isDefined(state.csrf_token);
          assert.match(state.csrf_token, patterns.uuid);
          assert.called(webex.getWindow().sessionStorage.setItem);
          assert.calledWith(
            webex.getWindow().sessionStorage.setItem,
            'oauth2-csrf-token',
            state.csrf_token
          );
        });
      });

      it('adds a pkce code challenge', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        const expectedCodeChallenge = 'test challenge';

        sinon.spy(webex.authorization, 'initiateAuthorizationCodeGrant');
        sinon.stub(webex.authorization, '_generateCodeChallenge').returns(expectedCodeChallenge);

        return webex.authorization.initiateLogin().then(() => {
          assert.called(webex.authorization.initiateAuthorizationCodeGrant);
          const grantOptions =
            webex.authorization.initiateAuthorizationCodeGrant.getCall(0).args[0];

          assert.equal(grantOptions.code_challenge, expectedCodeChallenge);
          assert.equal(grantOptions.code_challenge_method, 'S256');
          // eslint-disable-next-line no-underscore-dangle
          assert.calledWith(webex.authorization._generateCodeChallenge);
        });
      });

      it('adds emailHash', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        const expectedEmailHash =
          '73062d872926c2a556f17b36f50e328ddf9bff9d403939bd14b6c3b7f5a33fc2';

        sinon.spy(webex.authorization, 'initiateAuthorizationCodeGrant');

        return webex.authorization.initiateLogin({email: 'test@email.com'}).then(() => {
          assert.called(webex.authorization.initiateAuthorizationCodeGrant);
          const grantOptions =
            webex.authorization.initiateAuthorizationCodeGrant.getCall(0).args[0];

          assert.equal(grantOptions.emailHash, expectedEmailHash);
          assert.isUndefined(grantOptions.email);
        });
      });

      it('sets #isAuthorizing', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        assert.isFalse(webex.authorization.isAuthorizing);
        const p = webex.authorization.initiateLogin();

        assert.isTrue(webex.authorization.isAuthorizing);

        return p.then(() => assert.isFalse(webex.authorization.isAuthorizing));
      });

      it('sets #isAuthenticating', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        assert.isFalse(webex.authorization.isAuthenticating);
        const p = webex.authorization.initiateLogin();

        assert.isTrue(webex.authorization.isAuthenticating);

        return p.then(() => assert.isFalse(webex.authorization.isAuthenticating));
      });
    });

    describe('#initiateAuthorizationCodeGrant()', () => {
      it('redirects to the login page with response_type=code', () => {
      const webex = makeWebex(undefined, undefined, {
        credentials: {
        clientType: 'confidential',
        },
      });

      sinon.spy(webex.authorization, 'initiateAuthorizationCodeGrant');

      return webex.authorization.initiateLogin().then(() => {
        assert.called(webex.authorization.initiateAuthorizationCodeGrant);
        assert.include(webex.getWindow().location, 'response_type=code');
      });
      });

      it('redirects to the login page in the same window by default', () => {
      const webex = makeWebex();

      return webex.authorization.initiateAuthorizationCodeGrant().then(() => {
        assert.isDefined(webex.getWindow().location);
        assert.isUndefined(webex.getWindow().open);
      });
      });

      it('opens login page in a new window when separateWindow is true', () => {
      const webex = makeWebex();
      webex.getWindow().open = sinon.spy();

      return webex.authorization.initiateAuthorizationCodeGrant({ separateWindow: true }).then(() => {
        assert.called(webex.getWindow().open);
        const openCall = webex.getWindow().open.getCall(0);
        assert.equal(openCall.args[1], '_blank');
        assert.equal(openCall.args[2], 'width=600,height=800');
      });
      });

      it('opens login page in a new window with custom dimensions', () => {
      const webex = makeWebex();
      webex.getWindow().open = sinon.spy();

      const customWindow = {
        width: 800,
        height: 600,
        menubar: 'no',
        toolbar: 'no'
      };

      return webex.authorization.initiateAuthorizationCodeGrant({ 
        separateWindow: customWindow 
      }).then(() => {
        assert.called(webex.getWindow().open);
        const openCall = webex.getWindow().open.getCall(0);
        assert.equal(openCall.args[1], '_blank');
        assert.equal(
        openCall.args[2], 
        'width=800,height=600,menubar=no,toolbar=no'
        );
      });
      });

      it('preserves other options when using separateWindow', () => {
      const webex = makeWebex();
      webex.getWindow().open = sinon.spy();

      return webex.authorization.initiateAuthorizationCodeGrant({ 
        separateWindow: true,
        state: {}
      }).then(() => {
        assert.called(webex.getWindow().open);
        const url = webex.getWindow().open.getCall(0).args[0];
        assert.include(url, "https://idbrokerbts.webex.com/idb/oauth2/v1/authorize?response_type=code&separateWindow=true&client_id=fake&redirect_uri=http%3A%2F%2Fexample.com&scope=scope%3Aone");
      });
      });
    });

    describe('#_generateQRCodeVerificationUrl()', () => {
      it('should generate a QR code URL when a userCode is present', () => {
        const verificationUrl = 'https://example.com/verify?userCode=123456';
        const oauthHelperUrl = 'https://oauth-helper-a.wbx2.com/helperservice/v1';
        const expectedUrl = 'https://web.webex.com/deviceAuth?usercode=123456&oauthhelper=https%3A%2F%2Foauth-helper-a.wbx2.com%2Fhelperservice%2Fv1';

        const webex = makeWebex('http://example.com');

        const oauthHelperSpy = sinon.stub(webex.internal.services, 'get').returns(oauthHelperUrl);
        const result = webex.authorization._generateQRCodeVerificationUrl(verificationUrl);

        assert.calledOnce(oauthHelperSpy);
        assert.calledWithExactly(oauthHelperSpy, 'oauth-helper');
        assert.equal(result, expectedUrl);

        oauthHelperSpy.restore();
      });

      it('should return the original verificationUrl when userCode is not present', () => {
        const verificationUrl = 'https://example.com/verify';
        const webex = makeWebex('http://example.com');

        const oauthHelperSpy = sinon.stub(webex.internal.services, 'get');
        const result = webex.authorization._generateQRCodeVerificationUrl(verificationUrl);

        assert.notCalled(oauthHelperSpy);
        assert.equal(result, verificationUrl);

        oauthHelperSpy.restore();
      });
    });

    describe('#initQRCodeLogin()', () => {
      it('should prevent concurrent request if there is already a polling request', async () => {
        const webex = makeWebex('http://example.com');

        webex.authorization.pollingTimer = 1;
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');
        webex.authorization.initQRCodeLogin();

        assert.calledOnce(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'getUserCodeFailure');
        webex.authorization.pollingTimer = null;
      });

      it('should send correct request parameters to the API', async () => {
        const clock = sinon.useFakeTimers();
        const testClientId = 'test-client-id';
        const testScope = 'test-scope';
        const sampleData = {
          device_code: 'test123',
          expires_in: 300,
          user_code: '421175',
          verification_uri: 'http://example.com',
          verification_uri_complete: 'http://example.com',
          interval: 2,
        };

        const webex = makeWebex('http://example.com', undefined, undefined, {
          credentials: {
            client_id: testClientId,
            scope: testScope,
          },
        });
        webex.request.onFirstCall().resolves({statusCode: 200, body: sampleData});
        sinon.spy(webex.authorization, '_startQRCodePolling');
        sinon.spy(webex.authorization, '_generateQRCodeVerificationUrl');
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');

        webex.authorization.initQRCodeLogin();
        clock.tick(2000);
        await clock.runAllAsync();

        assert.calledTwice(webex.request);
        assert.calledOnce(webex.authorization._startQRCodePolling);
        assert.calledOnce(webex.authorization._generateQRCodeVerificationUrl);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'getUserCodeSuccess');

        const request = webex.request.getCall(0);

        assert.equal(request.args[0].form.client_id, testClientId);
        assert.equal(request.args[0].form.scope, testScope);
        clock.restore();
      });

      it('should use POST method and correct endpoint', async () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');
        const sampleData = {
          device_code: 'test123',
          expires_in: 300,
          user_code: '421175',
          verification_uri: 'http://example.com',
          verification_uri_complete: 'http://example.com',
          interval: 2,
        };
        webex.request.resolves().resolves({statusCode: 200, body: sampleData});

        webex.authorization.initQRCodeLogin();
        clock.tick(2000);
        await clock.runAllAsync();

        const request = webex.request.getCall(0);
        assert.equal(request.args[0].method, 'POST');
        assert.equal(request.args[0].service, 'oauth-helper');
        assert.equal(request.args[0].resource, '/actions/device/authorize');
        clock.restore();
      });

      it('should emit getUserCodeFailure event', async () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');
        webex.request.rejects(new Error('API Error'));
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');

        webex.authorization.initQRCodeLogin();

        await clock.runAllAsync();

        assert.calledOnce(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'getUserCodeFailure');
        clock.restore();
      });
    });

    describe('#_startQRCodePolling()', () => {
      it('requires a deviceCode', () => {
        const webex = makeWebex('http://example.com');

        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');

        webex.authorization._startQRCodePolling({});

        assert.calledOnce(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'authorizationFailure');
      });

      it('should send correct request parameters to the API', async () => {
        const clock = sinon.useFakeTimers();
        const testClientId = 'test-client-id';
        const testDeviceCode = 'test-device-code';

        const options = {
          device_code: testDeviceCode,
          interval: 2,
          expires_in: 300,
        };

        const webex = makeWebex('http://example.com', undefined, undefined, {
          credentials: {
            client_id: testClientId,
          },
        });

        webex.request.onFirstCall().resolves({statusCode: 200, body: {access_token: 'token'}});
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');
        const credentialsSetSpy = sinon.spy(webex.credentials, 'set');
        sinon.spy(webex.authorization, 'cancelQRCodePolling');

        webex.authorization._startQRCodePolling(options);
        clock.tick(2000);
        await clock.runAllAsync();

        assert.calledOnce(webex.request);

        const request = webex.request.getCall(0);

        assert.equal(request.args[0].form.client_id, testClientId);
        assert.equal(request.args[0].form.device_code, testDeviceCode);
        assert.equal(
          request.args[0].form.grant_type,
          'urn:ietf:params:oauth:grant-type:device_code'
        );

        assert.calledOnce(webex.authorization.cancelQRCodePolling);
        assert.calledOnce(credentialsSetSpy);
        assert.calledTwice(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'authorizationSuccess');
        assert.equal(emitSpy.getCall(1).args[1].eventType, 'pollingCanceled');

        clock.restore();
      });

      it('should respect polling interval', async () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');
        const options = {
          device_code: 'test-device-code',
          interval: 2,
          expires_in: 300,
        };

        webex.request
          .onFirstCall()
          .rejects({statusCode: 428, body: {message: 'authorization_pending'}});
        webex.request.onSecondCall().resolves({statusCode: 200, body: {access_token: 'token'}});
        sinon.spy(webex.authorization, 'cancelQRCodePolling');
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');

        webex.authorization._startQRCodePolling(options);
        await clock.tickAsync(4000);
        //await clock.runAllAsync()

        assert.calledTwice(webex.request);
        assert.calledOnce(webex.authorization.cancelQRCodePolling);
        assert.calledThrice(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'authorizationPending');
        assert.equal(emitSpy.getCall(1).args[1].eventType, 'authorizationSuccess');
        assert.equal(emitSpy.getCall(2).args[1].eventType, 'pollingCanceled');
        clock.restore();
      });

      it('should timeout after expires_in seconds', async () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');
        const options = {
          device_code: 'test-device-code',
          interval: 5,
          expires_in: 9,
        };

        webex.request.rejects({statusCode: 428, body: {message: 'authorizationPending'}});
        sinon.spy(webex.authorization, 'cancelQRCodePolling');
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');

        webex.authorization._startQRCodePolling(options);
        await clock.tickAsync(10_000);

        assert.calledOnce(webex.request);
        assert.calledOnce(webex.authorization.cancelQRCodePolling);
        assert.calledTwice(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'authorizationPending');
        assert.equal(emitSpy.getCall(1).args[1].eventType, 'authorizationFailure');
        clock.restore();
      });

      it('should prevent concurrent polling attempts if this is already a polling request', async () => {
        const webex = makeWebex('http://example.com');
        const options = {
          device_code: 'test-device-code',
          interval: 2,
          expires_in: 300,
        };

        webex.authorization.pollingTimer = 1;

        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');
        webex.authorization._startQRCodePolling(options);

        assert.calledOnce(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'authorizationFailure');
        webex.authorization.pollingTimer = null;
      });

      it('should skip a interval when server ask for slow_down', async () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');
        const options = {
          device_code: 'test-device-code',
          interval: 2,
          expires_in: 300,
        };

        webex.request.onFirstCall().rejects({statusCode: 400, body: {message: 'slow_down'}});
        webex.request.onSecondCall().resolves({statusCode: 200, body: {access_token: 'token'}});
        sinon.spy(webex.authorization, 'cancelQRCodePolling');
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');
        const credentialsSetSpy = sinon.spy(webex.credentials, 'set');
        
        webex.authorization._startQRCodePolling(options);
        await clock.tickAsync(4000);

        // Request only once because of slow_down
        assert.calledOnce(webex.request);

        // Wait for next interval
        await clock.tickAsync(2000);

        assert.calledTwice(webex.request);
        assert.calledOnce(webex.authorization.cancelQRCodePolling);
        assert.calledOnce(credentialsSetSpy);
        assert.calledTwice(emitSpy);
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'authorizationSuccess');
        assert.equal(emitSpy.getCall(1).args[1].eventType, 'pollingCanceled');
        clock.restore();
      });

      it('should ignore the response from the previous polling', async () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');
        const options = {
          device_code: 'test-device-code',
          interval: 2,
          expires_in: 300,
        };

        webex.request.onFirstCall().callsFake(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({statusCode: 200, body: {access_token: 'token'}});
            }, 1000);
          });
        });

        webex.request
          .onSecondCall()
          .rejects({statusCode: 428, body: {message: 'authorizationPending'}});
        sinon.spy(webex.authorization, 'cancelQRCodePolling');
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');

        webex.authorization._startQRCodePolling(options);
        await clock.tickAsync(2500);

        webex.authorization.cancelQRCodePolling();

        // Start new polling

        webex.authorization._startQRCodePolling(options);

        // Wait for next interval
        await clock.tickAsync(3000);

        assert.calledTwice(webex.request);
        assert.calledOnce(webex.authorization.cancelQRCodePolling);
        assert.calledTwice(emitSpy);
        // authorizationSuccess event should not be emitted
        assert.equal(emitSpy.getCall(0).args[1].eventType, 'pollingCanceled');
        assert.equal(emitSpy.getCall(1).args[1].eventType, 'authorizationPending');
        clock.restore();
      });
    });

    describe('#cancelQRCodePolling()', () => {
      it('should stop polling after cancellation', async () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');
        const options = {
          device_code: 'test-device-code',
          interval: 2,
          expires_in: 300,
        };

        webex.request.rejects({statusCode: 428, body: {message: 'authorizationPending'}});
        const emitSpy = sinon.spy(webex.authorization.eventEmitter, 'emit');

        webex.authorization._startQRCodePolling(options);
        // First poll
        clock.tick(2000);
        assert.calledOnce(webex.request);

        webex.authorization.cancelQRCodePolling();
        // Wait for next interval
        clock.tick(2000);

        const eventArgs = emitSpy.getCall(0).args;

        // Verify no additional requests were made
        assert.calledOnce(webex.request);
        assert.calledOnce(emitSpy);
        assert.equal(eventArgs[1].eventType, 'pollingCanceled');
        clock.restore();
      });
      it('should clear interval and reset polling request', () => {
        const clock = sinon.useFakeTimers();
        const webex = makeWebex('http://example.com');

        const options = {
          device_code: 'test_device_code',
          interval: 2,
          expires_in: 300,
        };

        webex.authorization._startQRCodePolling(options);
        assert.isDefined(webex.authorization.pollingTimer);

        webex.authorization.cancelQRCodePolling();
        assert.isNull(webex.authorization.pollingTimer);

        clock.restore();
      });

      it('should handle cancellation when no polling is in progress', () => {
        const webex = makeWebex('http://example.com');
        assert.isNull(webex.authorization.pollingTimer);

        webex.authorization.cancelQRCodePolling();
        assert.isNull(webex.authorization.pollingTimer);
      });
    });

    describe('#_generateCodeChallenge', () => {
      const expectedCodeChallenge = 'code challenge';
      // eslint-disable-next-line no-underscore-dangle
      const safeCharacterMap = CryptoJS.enc.Base64url._safe_map;

      const expectedVerifier = times(128, () => safeCharacterMap[0]).join('');

      it('generates a challenge code and stores it in session storage', () => {
        const webex = makeWebex('http://example.com');

        const toStringStub = sinon.stub().returns(expectedCodeChallenge);
        const randomStub = sinon.stub(lodash, 'random').returns(0);
        const sha256Stub = sinon.stub(CryptoJS, 'SHA256').returns({
          toString: toStringStub,
        });

        // eslint-disable-next-line no-underscore-dangle
        const codeChallenge = webex.authorization._generateCodeChallenge();

        assert.equal(codeChallenge, expectedCodeChallenge);
        assert.calledWith(sha256Stub, expectedVerifier);
        assert.calledWith(toStringStub, CryptoJS.enc.Base64url);
        assert.callCount(randomStub, 128);
        assert.calledWith(randomStub, 0, safeCharacterMap.length - 1);
        assert.calledWith(
          webex.getWindow().sessionStorage.setItem,
          'oauth2-code-verifier',
          expectedVerifier
        );
      });
    });

    describe('#_cleanUrl()', () => {
      it('removes the state parameter when it has no keys', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });
        const location = {
          query: {
            code: 'code',
            state: {
              csrf_token: 'token',
            },
          },
        };

        sinon.spy(webex.authorization, '_cleanUrl');
        webex.authorization._cleanUrl(location);
        assert.called(webex.getWindow().history.replaceState);
        assert.equal(webex.getWindow().location.href, '');
      });

      it('keeps the parameter when it has keys', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });
        const location = {
          query: {
            code: 'code',
            state: {
              csrf_token: 'token',
              key: 'value',
            },
          },
        };

        sinon.spy(webex.authorization, '_cleanUrl');
        webex.authorization._cleanUrl(location);
        assert.called(webex.getWindow().history.replaceState);
        const {href} = webex.getWindow().location;

        assert.isDefined(href);
        assert.equal(href, `?state=${base64.encode(JSON.stringify({key: 'value'}))}`);
        assert.notInclude(href, 'csrf_token');
      });
    });

    describe('#_extractOrgIdFromCode', () => {
      it('extracts the orgId from the code', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        const code = 'authcode_clusterid_theOrgId';
        const orgId = webex.authorization._extractOrgIdFromCode(code);

        assert.equal(orgId, 'theOrgId');
      });

      it('handles an invalid code', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        const code = 'authcode_clusterid_';
        const orgId = webex.authorization._extractOrgIdFromCode(code);

        assert.isUndefined(orgId);
      });

      it('handles an completely invalid code', () => {
        const webex = makeWebex(undefined, undefined, {
          credentials: {
            clientType: 'confidential',
          },
        });

        const code = 'authcode';
        const orgId = webex.authorization._extractOrgIdFromCode(code);

        assert.isUndefined(orgId);
      });
    });
  });
});
