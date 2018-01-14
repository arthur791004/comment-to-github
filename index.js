const fs = require('fs');

const post = require('./middlewares/post');
const github = require('./services/github');
const { PULL_REQUEST } = require('./services/github/constants');

require('dotenv').config();

const sendPrComment = async (installationId, url, comment) => {
  const ghAppId = process.env.GH_APP_ID;
  const ghAppKey = process.env.NODE_ENV === 'production'
    ? Buffer.from(process.env.GH_KEY, 'base64').toString()
    : fs.readFileSync(process.env.GH_KEY_PATH, 'utf-8');

  const installations = await github.setAppToken(ghAppId, ghAppKey)
    .getInstallations();

  const accessTokenUrl = installations
    .find(({ id }) => id === installationId)
    .access_tokens_url;

  return github.setAppToken(accessTokenUrl)
    .sendPrReview(url, comment);
};

module.exports = post(async (req, res) => {
  const { action, pull_request, installation, repository } = req.body;

  if (action !== PULL_REQUEST.ACTIONS.OPEN) {
    return {
      message: `ignored action of type ${action}`,
    };
  }

  const { user, head, url } = pull_request;
  const { id: installationId } = installation;
  const { name } = repository;
  const { ref: branch } = head;
  const comment = `
## Preview
- [Netlify](https://${branch.replace('/', '-')}--${name}.netlify.com)
  `.trim();

  const { id } = await sendPrComment(installationId, url, comment);

  return {
    date: Date.now(),
    id,
  };
});

