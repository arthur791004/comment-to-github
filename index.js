const fs = require('fs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { json } = require('micro');

require('dotenv').config();

const ACTIONS = {
  OPEN: 'opened',
};

const PULL_REQUEST_EVENTS = {
  APRROVE: 'APRROVE',
  COMMENT: 'COMMENT',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
};

const generateJWTToken = () => {
  const GH_KEY = process.env.NODE_ENV === 'production'
    ? Buffer.from(process.env.GH_KEY, 'base64').toString()
    : fs.readFileSync(process.env.GH_KEY_PATH, 'utf-8');

  const iat = Math.ceil(Date.now() / 1000); // seconds
  const expires = 60 * 8; // seconds;
  const payload = {
    iss: process.env.GH_APP_ID,
    iat,
    exp: iat + expires,
  };

  return jwt.sign(payload, GH_KEY, { algorithm: "RS256" });
};


const githubAPI = async (token, url, method, payload) => {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.machine-man-preview+json",
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };

  return await fetch(url, options)
    .then(res => res.json())
};

const getInstallations = async (token) => {
  const url = 'https://api.github.com/app/installations';

  return await githubAPI(token, url, 'GET');
};

const getAccessToken = async (token, accessTokenURL) => {
  return await githubAPI(token, accessTokenURL, 'POST');
}

const sendPRComment = async (installationID, url, comment) => {
  const token = generateJWTToken();
  const installations = await getInstallations(token);
  const accessTokenURL = installations
    .find(({ id }) => id === installationID)
    .access_tokens_url;

  const accessToken = await getAccessToken(token, accessTokenURL);
  const payload = {
    event: PULL_REQUEST_EVENTS.COMMENT,
    body: comment,
  };

  /**
   * https://api.github.com/repos/:owner/:repo/pulls/:number/reviews
   * @param {string} body
   * @param {APRROVE|REQUEST_CHANGES|COMMENT} event
   */
  return await githubAPI(accessToken.token, url, 'POST', payload)
};

const post = fn => async (req, res) => {
  if (req.method !== 'POST') {
    return {
      message: 'Only allow POST method',
    };
  }

  return fn({
    ...req,
    body: await json(req),
  }, res);
}

module.exports = post(async (req, res) => {
  const { action, pull_request, installation, repository } = req.body;
  const { user, head } = pull_request;
  const { id: installationID } = installation;
  const { name } = repository;
  const { ref: branch } = head;

  if (action !== ACTIONS.OPEN) {
    return res.end({
      message: `ignored action of type ${action}`,
    });
  }

  const url = `${pull_request.url}/reviews`;
  const comment = `
## Preview
- [Netlify](https://${branch.replace('/', '-')}--${name}.netlify.com)
  `.trim();

  const { id } = await sendPRComment(installationID, url, comment);

  return {
    date: Date.now(),
    id,
  };
});

