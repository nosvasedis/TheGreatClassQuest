import test from 'node:test';
import assert from 'node:assert/strict';
import {
    markAttendancePending,
    confirmAttendancePending,
    settleAttendancePending,
    withPendingAttendance,
    clearAllPendingAttendance
} from '../features/attendancePending.mjs';

const today = '27-10-2026';

test('an absent mark shows at once and stays until the listener brings the record', () => {
    clearAllPendingAttendance();
    const token = markAttendancePending('s1', { absent: true, date: today, classId: 'c1' });
    const shown = withPendingAttendance([]);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].studentId, 's1');
    assert.equal(shown[0].date, today);

    assert.equal(confirmAttendancePending('s1', token, 1000), true);
    assert.equal(withPendingAttendance([], 2000).length, 1, 'saved but not yet heard: still away');
    const saved = [{ id: 'a', studentId: 's1', date: today }];
    assert.deepEqual(withPendingAttendance(saved, 2000), saved);
    assert.deepEqual(withPendingAttendance([], 3000), [], 'the mark is forgotten once the listener agreed');
});

test('a present mark hides the saved record until it is gone', () => {
    clearAllPendingAttendance();
    const saved = [{ id: 'a', studentId: 's1', date: today }, { id: 'b', studentId: 's2', date: today }];
    const token = markAttendancePending('s1', { absent: false, date: today });
    assert.deepEqual(withPendingAttendance(saved).map((r) => r.id), ['b']);
    confirmAttendancePending('s1', token, 0);
    assert.deepEqual(withPendingAttendance([saved[1]], 10).map((r) => r.id), ['b']);
    assert.deepEqual(withPendingAttendance(saved, 20).map((r) => r.id), ['a', 'b'], 'listener agreed earlier: pending gone');
});

test('a failed save turns the cloud back; an older token never clears a newer mark', () => {
    clearAllPendingAttendance();
    const first = markAttendancePending('s1', { absent: true, date: today });
    const second = markAttendancePending('s1', { absent: false, date: today });
    assert.equal(settleAttendancePending('s1', first), false);
    assert.equal(withPendingAttendance([{ id: 'a', studentId: 's1', date: today }]).length, 0);
    assert.equal(settleAttendancePending('s1', second), true);
    assert.equal(withPendingAttendance([]).length, 0);
});

test('a saved mark the listener never confirms is dropped after the grace period', () => {
    clearAllPendingAttendance();
    const token = markAttendancePending('s1', { absent: true, date: today });
    confirmAttendancePending('s1', token, 0);
    assert.equal(withPendingAttendance([], 16000).length, 0);
});
