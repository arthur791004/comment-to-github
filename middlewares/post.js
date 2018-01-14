const { json } = require('micro');

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

module.exports = post;
