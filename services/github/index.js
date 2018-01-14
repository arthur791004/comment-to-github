const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const { PULL_REQUEST } = require('./constants');

let appToken = '';
let userToken = '';

class Github {
  constructor() {
    this.api = this.api.bind(this);
    this.appApi = this.appApi.bind(this);
    this.userApi = this.userApi.bind(this);
    this.setAppToken = this.setAppToken.bind(this);
    this.setUserToken = this.setUserToken.bind(this);

    /**
     * app apis
     */
    this.getInstallations = this.getInstallations.bind(this);

    /**
     * user apis
     */
    this.sendPrReview = this.sendPrReview.bind(this);
  }

  api({ token, url, method, payload }) {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.machine-man-preview+json",
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    };

    return fetch(url, options)
      .then(res => res.json);
  }

  appApi(options) {
    if (!appToken) {
      throw new Error('Please set app api token');
    }

    return this.api({
      ...options,
      token: appToken,
    });
  }

  userApi(options) {
    if (!appToken) {
      throw new Error('Please set user api token');
    }

    return this.api({
      ...options,
      token: userToken,
    });
  }

  setAppToken(ghAppId, ghAppKey) {
    const iat = Math.ceil(Date.now() / 1000); // seconds
    const expires = 60 * 8; // seconds;
    const payload = {
      iss: ghAppId,
      iat,
      exp: iat + expires,
    };

    appToken = jwt.sign(payload, ghAppKey, { algorithm: 'RS256' });

    return this;
  }

  setUserToken(url) {
    const { token } = await this.appApi({ url, method: 'POST' });

    userToken = token;

    return this;
  }

  getInstallations() {
    return this.appApi({
      url: 'https://api.github.com/app/installation',
      method: 'GET',
    });
  }

  sendPrReview(prUrl, comment) {
    /**
     * https://api.github.com/repos/:owner/:repo/pulls/:number/reviews
     * @param {string} body
     * @param {APRROVE|REQUEST_CHANGES|COMMENT} event
     */
    const payload = {
      event: PULL_REQUEST.EVENTS.COMMENT,
      body: comment,
    };

    return this.userApi({
      url: `${prUrl}/reviews`,
      method: 'POST',
      payload,
    });
  }
}

module.exports = new Github();
