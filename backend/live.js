/* Live events (socket.io) — a tiny pub/sub hub shared across the backend.
   server.js fills live.io at boot; routes call the helpers below to push
   realtime updates (wallet refresh, admin alerts) without polling. */

const live = { io: null };

/* Emit to one user's room (all their open tabs) */
function emitToUser(phone, event, payload) {
  if (!live.io || !phone) return;
  live.io.to("user:" + phone).emit(event, payload || {});
}

/* Emit to every connected admin panel */
function emitAdmin(event, payload) {
  if (!live.io) return;
  live.io.to("admins").emit(event, payload || {});
}

/* Broadcast to EVERY connected client (users + admins) — used for
   site-wide appearance (theme) changes so all open pages restyle live */
function emitAll(event, payload) {
  if (!live.io) return;
  live.io.emit(event, payload || {});
}

module.exports = { live, emitToUser, emitAdmin, emitAll };
