/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint camelcase: [0] */

import querystring from 'querystring';
import url from 'url';

import {base64, oneFlight, whileInFlight} from '@webex/common';
import {grantErrors, WebexPlugin} from '@webex/webex-core';
import {cloneDeep, isEmpty, omit} from 'lodash';
import uuid from 'uuid';
const jwt = require('jsonwebtoken');

const OAUTH2_CSRF_TOKEN = 'oauth2-csrf-token';
const EMPTY_OBJECT_STRING = base64.encode(JSON.stringify({}));

/**
 * Browser support for OAuth2. Automatically parses the URL hash for an access
 * token
 * @class
 * @name AuthorizationBrowser
 */
const Authorization = WebexPlugin.extend({
  derived: {
    /**
     * Alias of {@link AuthorizationBrowser#isAuthorizing}
     * @instance
     * @memberof AuthorizationBrowser
     * @type {boolean}
     */
    isAuthenticating: {
      deps: ['isAuthorizing'],
      fn() {
        return this.isAuthorizing;
      },
    },
  },

  session: {
    /**
     * Indicates if an Authorization Code exchange is inflight
     * @instance
     * @memberof AuthorizationBrowser
     * @type {boolean}
     */
    isAuthorizing: {
      default: false,
      type: 'boolean',
    },
    ready: {
      default: false,
      type: 'boolean',
    },
  },

  namespace: 'Credentials',

  /**
   * Initializer
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} attrs {@link AmpersandState}
   * @param {boolean} attrs.parse Controls whether or not the the url should get
   * parsed for an access token
   * @private
   * @returns {Authorization}
   */
  // eslint-disable-next-line complexity
  initialize(attrs, options) {
    const ret = Reflect.apply(WebexPlugin.prototype.initialize, this, [attrs, options]);

    // Reminder, we can't do parse based on config, because config is not
    // available until nextTick and we want to be able to throw errors found in
    // the url.
    if (attrs.parse === false) {
      this.ready = true;

      return ret;
    }
    const location = url.parse(this.webex.getWindow().location.href, true);

    this._checkForErrors(location);

    let {hash} = location;

    if (!hash) {
      this.ready = true;

      return ret;
    }
    if (hash.includes('#')) {
      hash = hash.substr(1);
    }
    location.hash = querystring.parse(hash);
    if (location.hash.state) {
      location.hash.state = JSON.parse(base64.decode(location.hash.state));
    }
    const tokenData = this._parseHash(location);

    if (!tokenData) {
      return ret;
    }
    this._cleanUrl(location);

    // Wait until nextTick in case `credentials` hasn't initialized yet
    process.nextTick(() => {
      this.webex.credentials.set({supertoken: tokenData});
      this.ready = true;
    });

    return ret;
  },

/**
 * Initiates the OAuth flow for user authentication.
 * This function determines the type of OAuth flow to use based on the client type configuration.
 * If the client is configured as "confidential", it will initiate the Authorization Code Grant flow;
 * otherwise, it will initiate the Implicit Grant flow.
 *
 * @instance
 * @memberof AuthorizationBrowser
 * @param {Object} options - The options to configure the OAuth flow.
 * @param {Object} [options.state] - An optional state object that can be used to include additional
 * information such as security tokens. A CSRF token will be automatically generated and added to
 * this state object.
 * @param {boolean|Object} [options.separateWindow] - Determines if the login should open in a separate window.
 * This can be a boolean or an object specifying window features:
 *   - If `true`, a new window with default dimensions is opened.
 *   - If an object, custom window features can be specified (e.g., `{width: 800, height: 600}`).
 * @returns {Promise<void>} - A promise that resolves when the appropriate OAuth flow has been initiated.
 * The promise does not necessarily indicate the completion of the login process.
 * @throws {Error} - Throws an error if there are issues initiating the OAuth flow.
 */
  initiateLogin(options = {}) {
    options.state = options.state || {};
    options.state.csrf_token = this._generateSecurityToken();

    // If we're not explicitly a confidential client, assume we're a public
    // client
    if (this.config.clientType === 'confidential') {
      return this.initiateAuthorizationCodeGrant(options);
    }

    return this.initiateImplicitGrant(options);
  },

  @whileInFlight('isAuthorizing')
/**
 * Initiates the Implicit Grant flow for authorization.
 * This function constructs the login URL and either opens it in a new
 * window or in the current window based on the provided options.
 * Typically called via {@link AuthorizationBrowser#initiateLogin}.
 *
 * @instance
 * @memberof AuthorizationBrowser
 * @param {Object} options - The options to configure the login flow.
 * @param {Object} [options.separateWindow] - Determines if the login should open in a separate window.
 * This can be a boolean or an object specifying window features:
 *   - If `true`, a new window with default dimensions is opened.
 *   - If an object, custom window features can be specified (e.g., `{width: 800, height: 600}`).
 * @returns {Promise<void>} - A promise that resolves immediately after initiating the login flow.
 * This promise does not indicate the completion of the login process.
 * @throws {Error} - Throws an error if the login URL cannot be constructed or if window opening fails.
 */
  initiateImplicitGrant(options) {

    this.logger.info('authorization: initiating implicit grant flow');
    const loginUrl = this.webex.credentials.buildLoginUrl(
      Object.assign({response_type: 'token'}, options)
    );

    if (options?.separateWindow) {
      // Default window settings
      const defaultWindowSettings = {
        width: 600,
        height: 800
      };

      // Merge user provided settings with defaults
      const windowSettings = Object.assign(
        defaultWindowSettings, 
        typeof options.separateWindow === 'object' ? options.separateWindow : {}
      );
      // Convert settings object to window.open features string
      const windowFeatures = Object.entries(windowSettings)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      this.webex.getWindow().open(loginUrl, '_blank', windowFeatures);
    } else {
      // Default behavior - open in same window
      this.webex.getWindow().location = loginUrl;
    }

    return Promise.resolve();
  },

  @whileInFlight('isAuthorizing')
  /**
   * Kicks off the Implicit Code grant flow. Typically called via
   * {@link AuthorizationBrowser#initiateLogin}
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} options
   * @returns {Promise}
   */
  initiateAuthorizationCodeGrant(options) {
    this.logger.info('authorization: initiating authorization code grant flow');
    this.webex.getWindow().location = this.webex.credentials.buildLoginUrl(
      Object.assign({response_type: 'code'}, options)
    );

    return Promise.resolve();
  },

  @oneFlight
  /**
   * Requests a Webex access token for a user already authenticated into
   * your product.
   *
   * Note: You'll need to supply a jwtRefreshCallback of the form
   * `Promise<jwt> = jwtRefreshCallback(webex)` for automatic token refresh to
   * work.
   *
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} options
   * @param {Object} options.jwt This is a jwt generated by your backend that
   * identifies a user in your system
   * @returns {Promise}
   */
  requestAccessTokenFromJwt({jwt}) {
    let hydraUri = this.webex.internal.services.get('hydra', true);

    if (hydraUri && hydraUri.slice(-1) !== '/') {
      // add a `/` to hydra's uri from the services catalog so that
      // it matches the current env service format.
      hydraUri += '/';
    }

    hydraUri = hydraUri || process.env.HYDRA_SERVICE_URL || 'https://api.ciscospark.com/v1/';

    return this.webex
      .request({
        method: 'POST',
        uri: `${hydraUri}jwt/login`,
        headers: {
          authorization: jwt,
        },
      })
      .then(({body}) => ({
        access_token: body.token,
        token_type: 'Bearer',
        expires_in: body.expiresIn,
      }))
      .then((token) => {
        this.webex.credentials.set({
          supertoken: token,
        });
      })
      .then(() => this.webex.internal.services.initServiceCatalogs());
  },

  /**
   * Called by {@link WebexCore#logout()}. Redirects to the logout page
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} options
   * @param {boolean} options.noRedirect if true, does not redirect
   * @returns {Promise}
   */
  logout(options = {}) {
    if (!options.noRedirect) {
      this.webex.getWindow().location = this.webex.credentials.buildLogoutUrl(options);
    }
  },

  /**
   * Creates a jwt user token
   * @param {object} options
   * @param {String} options.issuer Guest Issuer ID
   * @param {String} options.secretId Guest Secret ID
   * @param {String} options.displayName Guest Display Name | optional
   * @param {String} options.expiresIn
   * @returns {Promise<object>}
   */
  async createJwt({issuer, secretId, displayName, expiresIn}) {
    const secret = Buffer.from(secretId, 'base64');
    const payload = {
      "sub": `guest-user-${uuid()}`,
      "iss": issuer,
      "name": displayName || `Guest User - ${uuid()}`
    };
    const alg = 'HS256';

    try {

      const jwtToken = jwt.sign(payload, secret, { expiresIn });

      return Promise.resolve({jwt: jwtToken});
    } catch (e) {
      return Promise.reject(e);
    }
  },

  /**
   * Checks if the result of the login redirect contains an error string
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} location
   * @private
   * @returns {Promise}
   */
  _checkForErrors(location) {
    const {query} = location;

    if (query && query.error) {
      const ErrorConstructor = grantErrors.select(query.error);

      throw new ErrorConstructor(query);
    }
  },

  /**
   * Removes no-longer needed values from the url (access token, csrf token, etc)
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} location
   * @private
   * @returns {Promise}
   */
  _cleanUrl(location) {
    location = cloneDeep(location);
    if (this.webex.getWindow().history && this.webex.getWindow().history.replaceState) {
      [
        'access_token',
        'token_type',
        'expires_in',
        'refresh_token',
        'refresh_token_expires_in',
      ].forEach((key) => Reflect.deleteProperty(location.hash, key));
      if (!isEmpty(location.hash.state)) {
        location.hash.state = base64.encode(
          JSON.stringify(omit(location.hash.state, 'csrf_token'))
        );
        if (location.hash.state === EMPTY_OBJECT_STRING) {
          Reflect.deleteProperty(location.hash, 'state');
        }
      } else {
        Reflect.deleteProperty(location.hash, 'state');
      }
      location.hash = querystring.stringify(location.hash);
      this.webex.getWindow().history.replaceState({}, null, url.format(location));
    }
  },

  /**
   * Generates a CSRF token and sticks in in sessionStorage
   * @instance
   * @memberof AuthorizationBrowser
   * @private
   * @returns {Promise}
   */
  _generateSecurityToken() {
    this.logger.info('authorization: generating csrf token');

    const token = uuid.v4();

    this.webex.getWindow().sessionStorage.setItem('oauth2-csrf-token', token);

    return token;
  },

  /**
   * Parses the url hash into an access token object
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} location
   * @private
   * @returns {Object}
   */
  _parseHash(location) {
    const hash = cloneDeep(location.hash);

    if (hash) {
      this._verifySecurityToken(hash);
    }
    if (!hash.access_token) {
      this.ready = true;

      return undefined;
    }
    if (hash.expires_in) {
      hash.expires_in = parseInt(hash.expires_in, 10);
    }
    if (hash.refresh_token_expires_in) {
      hash.refresh_token_expires_in = parseInt(hash.refresh_token_expires_in, 10);
    }

    return hash;
  },

  /**
   * Checks if the CSRF token in sessionStorage is the same as the one returned
   * in the url.
   * @instance
   * @memberof AuthorizationBrowser
   * @param {Object} hash
   * @private
   * @returns {Promise}
   */
  _verifySecurityToken(hash) {
    const sessionToken = this.webex.getWindow().sessionStorage.getItem(OAUTH2_CSRF_TOKEN);

    this.webex.getWindow().sessionStorage.removeItem(OAUTH2_CSRF_TOKEN);
    if (!sessionToken) {
      return;
    }

    if (!hash.state) {
      throw new Error(`Expected CSRF token ${sessionToken}, but not found in redirect hash`);
    }

    if (!hash.state.csrf_token) {
      throw new Error(`Expected CSRF token ${sessionToken}, but not found in redirect hash`);
    }

    const token = hash.state.csrf_token;

    if (token !== sessionToken) {
      throw new Error(`CSRF token ${token} does not match stored token ${sessionToken}`);
    }
  },
});

export default Authorization;
