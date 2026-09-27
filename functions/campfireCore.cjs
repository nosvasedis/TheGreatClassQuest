function publicEmberNote({ oathId, summary, date, schoolYearKey }) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(oathId || '')) throw new Error('Invalid oath ID.');
  const text = typeof summary === 'string' ? summary.replace(/<[^>]*>/g, '').trim() : '';
  if (!text || text.length > 500) throw new Error('Write a family message of 1–500 characters.');
  return { source: 'ember_oath', oathId, schoolYearKey, label: 'A promise kept', body: text, createdAt: date };
}
function mergePublishedEmber(notes, note) {
  return [note, ...(Array.isArray(notes) ? notes : []).filter(n => !(n.source === 'ember_oath' && n.oathId === note.oathId))].slice(0, 6);
}
module.exports = { publicEmberNote, mergePublishedEmber };
