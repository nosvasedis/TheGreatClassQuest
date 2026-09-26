import test from 'node:test';
import assert from 'node:assert/strict';
import { toSafeDisplayName, setAllStudents, setAllSchoolClasses, get } from '../state.js';

test('names that could inject markup are neutralised when entering app state', () => {
  assert.equal(toSafeDisplayName('<img src=x onerror=alert(1)>'), '‹img src=x onerror=alert(1)›');
  assert.equal(toSafeDisplayName('x" onerror="alert(1)'), 'x” onerror=”alert(1)');
  assert.equal(toSafeDisplayName("O'Brien & Sons"), "O'Brien & Sons");

  const students = [{ id: 's1', name: 'Maria' }, { id: 's2', name: '<b>Nikos</b>' }];
  setAllStudents(students);
  assert.equal(get('allStudents')[0], students[0]);
  assert.equal(get('allStudents')[1].name, '‹b›Nikos‹/b›');

  const classes = [{ id: 'c1', name: 'Star Seekers' }];
  setAllSchoolClasses(classes);
  assert.equal(get('allSchoolClasses'), classes);
});
