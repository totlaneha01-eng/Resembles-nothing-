// Strips passwordHash before a User row goes out over the API. Shared so
// every route that returns a user (auth.js, artists.js's /apply, ...) goes
// through the same place instead of each remembering to destructure it out.
function publicUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

module.exports = { publicUser };
