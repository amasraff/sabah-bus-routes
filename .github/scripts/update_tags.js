// Adds or removes tags on one bus entry, based on the "Edit Tags" issue form.
const fs = require('fs');
const path = require('path');

const MIN_LENGTH = 2;
const MAX_LENGTH = 60;
const MAX_PER_REQUEST = 20;
const MAX_PER_BUS = 40;
const HEADINGS = ['Category', 'Bus Number', 'Destination', 'UID', 'Tags to add', 'Tags to remove'];

class InputError extends Error {}

const clean = s => String(s).replace(/\s+/g, ' ').trim();
const key = s => clean(s).toLowerCase();
const code = s => '`' + String(s).replace(/[`\r\n]/g, ' ') + '`';
// Compare the way the site search does: ignore case, spaces and punctuation.
// Names with no a-z or 0-9 characters are compared as typed.
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '') || key(s);

function readAliases(root) {
  const groups = JSON.parse(fs.readFileSync(path.join(root, 'Data/search_aliases.json'), 'utf8'));
  if (!Array.isArray(groups) || !groups.every(Array.isArray)) throw new Error('Unexpected aliases file format.');
  return groups;
}

// Splits new tags into those to add and repeats that differ only in capitals, spaces or
// punctuation. Short and full names are both kept, since people may know only one.
// Tags already on the bus stay; among new repeats, the longest spelling is kept.
function skipRepeats(existing, toAdd) {
  const kept = [...existing];
  const skipped = new Map();
  for (const tag of [...toAdd].sort((a, b) => b.length - a.length)) {
    const match = kept.find(k => norm(k) === norm(tag));
    if (match === undefined) kept.push(tag);
    else skipped.set(tag, match);
  }
  const added = toAdd.filter(t => !skipped.has(t));
  const notes = toAdd.filter(t => skipped.has(t)).map(t =>
    `Skipped ${code(t)}: same as ${code(skipped.get(t))} apart from capitals, spaces or punctuation.`);
  return { added, notes };
}

function parseBody(body, headings = HEADINGS) {
  const fields = {};
  let current = null;
  for (const line of String(body || '').split(/\r?\n/)) {
    const heading = line.match(/^### (.+?)\s*$/);
    if (heading && headings.includes(heading[1])) {
      current = heading[1];
      if (current in fields) throw new InputError(`The ${current} field appears twice.`);
      fields[current] = [];
    } else if (current) {
      fields[current].push(line);
    }
  }
  for (const name of Object.keys(fields)) {
    const value = fields[name].join('\n').trim();
    fields[name] = value === '_No response_' ? '' : value;
  }
  return fields;
}

function parseTags(raw) {
  const seen = new Set();
  const tags = (raw || '').split(/[,\n]/).map(clean)
    .filter(t => t && !seen.has(key(t)) && seen.add(key(t)));
  if (tags.length > MAX_PER_REQUEST) {
    throw new InputError(`Too many tags. The limit is ${MAX_PER_REQUEST} to add and ${MAX_PER_REQUEST} to remove per request.`);
  }
  return tags;
}

function checkNewTag(tag) {
  if (tag.length < MIN_LENGTH || tag.length > MAX_LENGTH) {
    throw new InputError(`Each tag must be ${MIN_LENGTH} to ${MAX_LENGTH} characters: ${code(tag.slice(0, 80))}`);
  }
  if (/[<>`@\[\]]|https?:|www\./i.test(tag) || /^#/.test(tag)) {
    throw new InputError(`Tags must be place names, without links or symbols such as @ < > [ ]: ${code(tag)}`);
  }
}

const destinationsOf = bus => (bus.towards || []).flatMap(t => [].concat(t.destination || []));

function describe(bus) {
  return `- UID ${code(bus.uid)}: ${bus.busName || '(no number)'}, ${bus.operator || 'no operator'}, ${destinationsOf(bus).join(' / ')}`;
}

function findBus(buses, { busNumber, destination, uid }) {
  if (!uid && !busNumber && !destination) {
    throw new InputError('Please give a Bus Number. If the bus has no number, give a Destination or UID.');
  }
  let matches = buses;
  if (uid) {
    const wanted = /^\d+$/.test(uid) ? uid.padStart(3, '0') : uid;
    matches = matches.filter(b => b.uid === wanted);
  }
  if (busNumber) matches = matches.filter(b => key(b.busName || '') === key(busNumber));
  if (destination) matches = matches.filter(b => destinationsOf(b).some(d => key(d) === key(destination)));
  if (!matches.length) {
    throw new InputError('No bus matches those details in this category. Check the category, number, destination and UID.');
  }
  if (matches.length > 1) {
    throw new InputError(`More than one entry matches. Add the Destination or UID.\n\n${matches.map(describe).join('\n')}`);
  }
  return matches[0];
}

// Puts a new "tags" field right after "towards", as in the template.
function setTags(bus, tags) {
  if ('tags' in bus) {
    bus.tags = tags;
    return bus;
  }
  const result = {};
  for (const [name, value] of Object.entries(bus)) {
    result[name] = value;
    if (name === 'towards') result.tags = tags;
  }
  if (!('tags' in result)) result.tags = tags;
  return result;
}

function updateTags(body, root = '.') {
  const fields = parseBody(body);
  const city = JSON.parse(fs.readFileSync(path.join(root, 'city.json'), 'utf8'));
  const category = Object.values(city.city).flat().find(c => c.label === fields['Category']);
  if (!category) throw new InputError('Unknown category.');

  const toAdd = parseTags(fields['Tags to add']);
  const toRemove = parseTags(fields['Tags to remove']);
  if (!toAdd.length && !toRemove.length) throw new InputError('There are no tags to add or remove.');
  toAdd.forEach(checkNewTag);
  const both = toAdd.filter(a => toRemove.some(r => key(r) === key(a)));
  if (both.length) throw new InputError(`These are in both lists: ${both.map(code).join(', ')}`);

  const filePath = path.join(root, category.fileName);
  const text = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(text);
  const bus = findBus(data.buses, {
    busNumber: clean(fields['Bus Number'] || ''),
    destination: clean(fields['Destination'] || ''),
    uid: clean(fields['UID'] || ''),
  });

  const existing = Array.isArray(bus.tags) ? bus.tags : [];
  const removed = existing.filter(t => toRemove.some(r => key(r) === key(t)));
  const missing = toRemove.filter(r => !existing.some(t => key(r) === key(t)));
  const tags = existing.filter(t => !removed.includes(t));
  const { added, notes } = skipRepeats(tags, toAdd);
  tags.push(...added);

  if (missing.length) notes.push(`Not found, so not removed: ${missing.map(code).join(', ')}`);
  if (!added.length && !removed.length) throw new InputError(['Nothing to change.', ...notes].join('\n'));
  if (added.length && tags.length > MAX_PER_BUS) {
    throw new InputError(`This would give the bus ${tags.length} tags. The limit is ${MAX_PER_BUS}.`);
  }

  data.buses[data.buses.indexOf(bus)] = setTags(bus, tags);

  // Keep the file's line endings and final newline so only real changes show.
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let output = JSON.stringify(data, null, 4).replace(/\n/g, eol);
  if (text.endsWith('\n')) output += eol;
  fs.writeFileSync(filePath, output);

  const summary = [`Tags updated for ${code(bus.busName || 'UID ' + bus.uid)} in ${category.label}.`];
  if (added.length) summary.push(`Added: ${added.map(code).join(', ')}`);
  if (removed.length) summary.push(`Removed: ${removed.map(code).join(', ')}`);
  return [...summary, ...notes].join('\n');
}

// Runs an update and saves the outcome for the workflow to report.
function run(update, failureMessage) {
  let ok = true;
  let message;
  try {
    message = update(process.env.ISSUE_BODY);
  } catch (error) {
    ok = false;
    message = error instanceof InputError ? error.message : failureMessage;
    if (!(error instanceof InputError)) console.error(error);
  }
  fs.writeFileSync(process.env.RESULT_FILE, JSON.stringify({ ok, message }));
}

module.exports = { updateTags, InputError, parseBody, readAliases, norm, clean, code, run };

if (require.main === module) run(updateTags, 'The tag update failed. Check the workflow log.');
