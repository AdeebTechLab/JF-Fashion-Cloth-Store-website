const { getSessionFromRequest } = require('../lib/auth');

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  res.status(200).json({ authenticated: !!session, username: session ? session.u : null });
};
