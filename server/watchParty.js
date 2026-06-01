'use strict';
/**
 * CyanFin Watch Party — WebSocket room broker
 * Real-time sync: play/pause/seek propagated to all room members
 */
let wss = null;
const rooms = new Map(); // roomId → { members: Map<ws, {userId, username}>, state: {itemId, positionMs, playing, updatedBy} }

function getRoomId(itemId, userId) {
  return `room-${itemId}`;
}

function broadcast(room, msg, excludeWs = null) {
  const data = JSON.stringify(msg);
  for (const [ws] of room.members) {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(data);
  }
}

function getRoomInfo(room) {
  return {
    members: [...room.members.values()].map(m => ({ userId: m.userId, username: m.username })),
    state: room.state,
  };
}

function start(server) {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server, path: '/ws/party' });
  console.log('[WatchParty] WebSocket server started at /ws/party');

  wss.on('connection', (ws, req) => {
    let currentRoom = null;
    let member = null;

    ws.on('message', rawMsg => {
      let msg;
      try { msg = JSON.parse(rawMsg); } catch { return; }

      // ── Join room ──────────────────────────────────────────────────────────
      if (msg.type === 'join') {
        const { roomId, userId, username } = msg;
        if (!roomId) return;
        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            members: new Map(),
            state: { itemId: msg.itemId || null, positionMs: 0, playing: false, updatedBy: null }
          });
        }
        currentRoom = rooms.get(roomId);
        member = { userId, username };
        currentRoom.members.set(ws, member);

        // Send current state to new member
        ws.send(JSON.stringify({ type: 'room', ...getRoomInfo(currentRoom) }));
        // Notify others
        broadcast(currentRoom, { type: 'joined', userId, username, memberCount: currentRoom.members.size }, ws);
        console.log(`[WatchParty] ${username} joined ${roomId} (${currentRoom.members.size} members)`);
        return;
      }

      if (!currentRoom || !member) return;

      // ── Sync events ────────────────────────────────────────────────────────
      if (msg.type === 'play' || msg.type === 'pause' || msg.type === 'seek') {
        currentRoom.state.positionMs = msg.positionMs ?? currentRoom.state.positionMs;
        currentRoom.state.playing    = msg.type === 'play' ? true : msg.type === 'pause' ? false : currentRoom.state.playing;
        currentRoom.state.updatedBy  = member.username;
        // Forward to all others
        broadcast(currentRoom, { ...msg, from: member.username, fromId: member.userId }, ws);
        return;
      }

      // ── Chat message ───────────────────────────────────────────────────────
      if (msg.type === 'chat') {
        broadcast(currentRoom, { type: 'chat', from: member.username, text: msg.text, ts: Date.now() });
        return;
      }

      // ── Emoji reaction ─────────────────────────────────────────────────────
      if (msg.type === 'reaction') {
        broadcast(currentRoom, { type: 'reaction', emoji: msg.emoji, from: member.username });
        return;
      }
    });

    ws.on('close', () => {
      if (currentRoom && member) {
        currentRoom.members.delete(ws);
        broadcast(currentRoom, { type: 'left', userId: member.userId, username: member.username, memberCount: currentRoom.members.size });
        if (currentRoom.members.size === 0) {
          const roomId = [...rooms.entries()].find(([, r]) => r === currentRoom)?.[0];
          if (roomId) { rooms.delete(roomId); console.log(`[WatchParty] Room ${roomId} closed`); }
        }
      }
    });

    ws.on('error', () => {});
  });
}

function getRooms() {
  return [...rooms.entries()].map(([id, r]) => ({
    id, memberCount: r.members.size, state: r.state,
  }));
}

module.exports = { start, getRooms };
