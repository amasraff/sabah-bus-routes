// Adds other names for a place, based on the "Add Other Spellings" issue form.
const fs = require('fs');
const path = require('path');
const { InputError, parseBody, readAliases, norm, clean, code, run } = require('./update_tags.js');

const MIN_LENGTH = 2;
const MAX_LENGTH = 60;
const MAX_PER_REQUEST = 10;
const MAX_PER_GROUP = 15;
// Words that would match far too much on their own.
const TOO_BROAD = ['kk', 'kota', 'kinabalu', 'kotakinabalu', 'sabah', 'bus', 'busstop', 'terminal', 'jalan', 'taman',
  'hospital', 'klinik', 'clinic', 'school', 'sekolah', 'university', 'universiti', 'college', 'mall', 'plaza',
  'market', 'pasar', 'town', 'pekan', 'bandar', 'kampung', 'kg'];

function checkName(name) {
  const simple = norm(name);
  if (!/[a-z0-9]/i.test(name) || simple.length < MIN_LENGTH || name.length > MAX_LENGTH) {
    throw new InputError(`Each name needs at least ${MIN_LENGTH} letters or numbers and at most ${MAX_LENGTH} characters: ${code(name.slice(0, 80))}`);
  }
  if (/[<>`@\[\]"\\]|https?:|www\./i.test(name) || /^#/.test(name)) {
    throw new InputError(`Names must be place names, without links or symbols such as @ < > [ ] " \\: ${code(name)}`);
  }
  if (TOO_BROAD.includes(simple)) {
    throw new InputError(`${code(name)} is too broad to use as another spelling.`);
  }
}

// One group per line, the same layout as the existing file.
function format(groups) {
  return '[\n' + groups.map(g => `    [${g.map(n => JSON.stringify(n)).join(', ')}]`).join(',\n') + '\n]';
}

function updateAliases(body, root = '.') {
  const fields = parseBody(body, ['Place name', 'Other names or spellings']);
  const place = clean(fields['Place name'] || '');
  const others = (fields['Other names or spellings'] || '').split(/[,\n]/).map(clean).filter(Boolean);
  if (!place || !others.length) throw new InputError('Give a place name and at least one other name.');
  if (place.includes(',')) throw new InputError('Put only one name in Place name.');

  const seen = new Set();
  const names = [place, ...others].filter(n => !seen.has(norm(n)) && seen.add(norm(n)));
  if (names.length > MAX_PER_REQUEST) throw new InputError(`Too many names. The limit is ${MAX_PER_REQUEST} per request.`);

  const groups = readAliases(root);
  const has = (group, name) => group.some(g => norm(g) === norm(name));
  const matching = groups.filter(g => names.some(n => has(g, n)));
  if (matching.length > 1) {
    const found = matching.map(g => '- ' + g.map(code).join(', ')).join('\n');
    throw new InputError(`These names appear in more than one existing group, so nothing was merged. The owner needs to check and edit \`Data/search_aliases.json\` if needed.\n\n${found}`);
  }

  const group = matching[0] || [];
  const added = names.filter(n => !has(group, n));
  if (!added.length) throw new InputError(`Nothing to change. Already paired: ${group.map(code).join(', ')}`);
  if (!matching.length && names.length < 2) throw new InputError('Give at least two different names. Capitals, spaces and punctuation are already ignored.');
  added.forEach(checkName);
  if (group.length + added.length > MAX_PER_GROUP) throw new InputError(`A group can have at most ${MAX_PER_GROUP} names.`);

  group.push(...added);
  if (!matching.length) groups.push(group);

  const filePath = path.join(root, 'Data/search_aliases.json');
  const text = fs.readFileSync(filePath, 'utf8');
  let output = format(groups);
  if (text.includes('\r\n')) output = output.replace(/\n/g, '\r\n');
  if (text.endsWith('\n')) output += text.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(filePath, output);

  return `Search now treats these as the same place: ${group.map(code).join(', ')}\nAdded: ${added.map(code).join(', ')}`;
}

module.exports = { updateAliases };

if (require.main === module) run(updateAliases, 'The alias update failed. Check the workflow log.');
